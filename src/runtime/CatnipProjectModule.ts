import { CatnipEventArgs, CatnipEventID, CatnipEventListener, CatnipEvents, CatnipEventValueTypeInfo, CatnipEventValueTypes } from "../CatnipEvents";
import { createLogger, Logger } from "../log";
import { CatnipProject } from "../runtime/CatnipProject";
import { CATNIP_DEFAULT_STEP_RATE, CatnipRuntimeModule, catnipTickBudgetMs } from "../runtime/CatnipRuntimeModule";
import { CatnipWasmStructRuntime } from "../wasm-interop/CatnipWasmStructRuntime";
import { WasmStructValue, WasmStructWrapper } from "../wasm-interop/wasm-types";
import { CatnipRuntimeGcStats, CatnipWasmStructRuntimeGcStats } from '../wasm-interop/CatnipWasmStructRuntimeGcStats';
import { CatnipBubbleUpdate, DRAW_STATE, DRAW_STATE_STRIDE } from "./ICatnipRenderer";
import { CatnipWasmStructHeapString } from "../wasm-interop/CatnipWasmStructHeapString";
import UTF16 from "../utf16";
import { CATNIP_TARGET_FLAG_IS_DRAGGING, CATNIP_TARGET_FLAG_IS_DRAGGABLE, CATNIP_TARGET_FLAG_IS_VISIBLE, CatnipWasmStructTarget } from "../wasm-interop/CatnipWasmStructTarget";
import { CatnipTouchQueries } from "../touch/CatnipTouchQueries";

export type CatnipProjectModuleEvent<TEvnetID extends CatnipEventID = CatnipEventID> = { id: TEvnetID, exportName: string };

export class CatnipProjectModule {
    private static readonly _logger: Logger = createLogger("CatnipProjectModule");

    public readonly project: CatnipProject;
    
    public readonly runtimeModule: CatnipRuntimeModule;
    public readonly runtimeInstance: WasmStructWrapper<typeof CatnipWasmStructRuntime>;

    public readonly instance: WebAssembly.Instance;
    private _events: Map<CatnipEventID, CatnipEventListener> = new Map();

    private _stepRate: number;

    // Draw-state slots: 0..n-1 are the sprites of project.json in order and
    // never move (clones are what get disposed), clones take later slots and
    // are recycled through the free list. A null slot is a hole where a clone
    // used to be; its rows serialize as zeroes and the renderer skips them.
    private _slots: (WasmStructWrapper<typeof CatnipWasmStructTarget> | null)[];
    private _slotByPtr: Map<number, number>;
    private _slotSpriteIndex: number[];
    private _freeSlots: number[];
    private _spriteIndexBySpritePtr: Map<number, number>;

    // The mouse pick that started a drag (scratch-gui's job in front of
    // scratch-vm), with whether the cursor moved while it was held.
    private _dragTarget: number = 0;
    private _dragMoved: boolean = false;

    // The sensing mouse position: scratch's io/mouse keeps the last posted
    // scratch coordinates, NaN until the first mouse move (the `_mouse_`
    // pixel query then never matches — same as scratch's uninitialized
    // _scratchX/_scratchY going through clientSpaceToScratchBounds).
    private _mouseX: number = NaN;
    private _mouseY: number = NaN;

    /** The sensing touch queries (touching / touching color). */
    public readonly touch: CatnipTouchQueries;

    /** @internal */
    constructor(project: CatnipProject, instance: WebAssembly.Instance, events: CatnipProjectModuleEvent[]) {
        this.project = project;
        this.instance = instance;
        this.runtimeModule = project.runtimeModule;
        this.runtimeInstance = project.runtimeInstance;
        this._stepRate = CATNIP_DEFAULT_STEP_RATE;

        this._events = new Map();
        for (const event of events) {
            const eventExport = this.instance.exports[event.exportName] as (CatnipEventListener | undefined);
            if (eventExport === undefined) throw new Error(`Can't find event export '${event.exportName}'.`);
            this._events.set(event.id, eventExport);
        }

        this._slots = [];
        this._slotByPtr = new Map();
        this._slotSpriteIndex = [];
        this._freeSlots = [];
        this._spriteIndexBySpritePtr = new Map();

        for (const sprite of project.sprites) {
            const wrapper = sprite.defaultTarget.structWrapper;
            const slot = this._slots.length;
            this._slots.push(wrapper);
            this._slotSpriteIndex.push(slot);
            this._slotByPtr.set(wrapper.ptr, slot);
            this._spriteIndexBySpritePtr.set(sprite.structWrapper.ptr, slot);
        }

        this.touch = new CatnipTouchQueries(this);
        // The touch imports run against the runtime module, which points at
        // the active project module's queries (the import bodies check for
        // null so a runtime compiled without a module still instantiates).
        this.runtimeModule.touch = this.touch;
    }

    /**
     * Reconcile the touch query slot view with the live target chain. Safe
     * to call any number of times (it is the serialization-time sync): a
     * query entry calls it once so clones created since the last frame are
     * candidates and deleted ones are gone.
     */
    public syncTouchSlots(): void {
        this._syncSlots();
    }

    /** Number of draw-state slots (originals + live clones; holes included). */
    public get slotCount(): number {
        return this._slots.length;
    }

    /** The target wrapper in a slot, or null for a hole. */
    public getSlot(index: number): WasmStructWrapper<typeof CatnipWasmStructTarget> | null {
        return this._slots[index] ?? null;
    }

    /** The sprite index a slot belongs to (project.json order for the
     *  originals, -1 for an unmapped hole). */
    public getSlotSpriteIndex(index: number): number {
        return this._slotSpriteIndex[index] ?? -1;
    }

    /** The slot a live target pointer maps to, or -1. */
    public findSlotByPtr(ptr: number): number {
        return this._slotByPtr.get(ptr) ?? -1;
    }

    /** The target currently being mouse-dragged, or 0. */
    public get dragTargetPtr(): number {
        return this._dragTarget;
    }

    /** The last mouse position in scratch coordinates (NaN before the first
     *  move — the `_mouse_` touch query then reads as off-stage). */
    public get mouseX(): number {
        return this._mouseX;
    }

    public get mouseY(): number {
        return this._mouseY;
    }

    /**
     * Reconciles the slots with the live wasm target chain: a clone that
     * appeared takes a free (or new) slot and its drawable is announced to
     * the renderer, one that was deleted leaves a null hole. Runs before any
     * serialization so the arrays the renderer gets always cover every
     * drawable it has been told about.
     *
     * Memory freed by a deleted clone may be handed to the next allocation,
     * so a live pointer can reappear as a different target: a pointer whose
     * sprite no longer matches the slot was recycled and is re-added.
     */
    private _syncSlots(): void {
        const live = new Set<number>();

        let ptr: number = this.runtimeInstance.getMember("targets");
        while (ptr !== 0) {
            let slot = this._slotByPtr.get(ptr);

            if (slot === undefined) {
                slot = this._addSlot(ptr);
            } else if (this._spriteIndexBySpritePtr.get(this._slots[slot]!.getMember("sprite")) !== this._slotSpriteIndex[slot]) {
                this._removeSlot(ptr, slot);
                slot = this._addSlot(ptr);
            }

            live.add(ptr);
            ptr = this._slots[slot]!.getMember("next_global");
        }

        const removed: [number, number][] = [];
        for (const [deadPtr, slot] of this._slotByPtr) {
            if (!live.has(deadPtr)) removed.push([deadPtr, slot]);
        }
        for (const [deadPtr, slot] of removed)
            this._removeSlot(deadPtr, slot);
    }

    private _addSlot(ptr: number): number {
        const wrapper = CatnipWasmStructTarget.getWrapper(ptr, () => this.runtimeModule.memory);
        const slot = this._freeSlots.pop() ?? this._slots.length;

        if (slot === this._slots.length) {
            this._slots.push(null);
            this._slotSpriteIndex.push(-1);
        }

        this._slots[slot] = wrapper;
        this._slotByPtr.set(ptr, slot);

        const spriteIndex = this._spriteIndexBySpritePtr.get(wrapper.getMember("sprite")) ?? -1;
        this._slotSpriteIndex[slot] = spriteIndex;
        this.runtimeModule.renderer.cloneAdd(slot, spriteIndex);
        return slot;
    }

    private _removeSlot(ptr: number, slot: number): void {
        this._slotByPtr.delete(ptr);
        this._slots[slot] = null;
        this._freeSlots.push(slot);
        this.runtimeModule.renderer.cloneRemove(slot);
    }

    /**
     * The wasm pointer of the target in draw-state slot `index`, or 0 when
     * the slot is empty — the way both the page's click pick and the test
     * harness turn their index into the target an event belongs to. Clones
     * live in slots too, so clicking one delivers that clone.
     */
    public getTargetPointer(index: number): number {
        this._syncSlots();

        if (index < 0 || index >= this._slots.length) return 0;
        const wrapper = this._slots[index];
        return wrapper === null ? 0 : wrapper.ptr;
    }

    /**
     * A mouse pick landed on draw-state slot `index`. Scratch's click rules
     * (mouse.js postData): a non-draggable target clicks on mouse down, a
     * draggable one starts a drag instead and only clicks on mouse up — and
     * never when the cursor moved in between (`wasDragged`).
     */
    public mousePick(index: number): void {
        const ptr = this.getTargetPointer(index);
        if (ptr === 0) return;

        // A stale drag (missed mouseup) would keep blocking setXY forever.
        if (this._dragTarget !== 0 && this._dragTarget !== ptr)
            this._setDragging(this._dragTarget, false);

        const flags = this.runtimeModule.memory.getUint32(
            ptr + CatnipWasmStructTarget.getMemberOffset("flags"), true);
        if ((flags & CATNIP_TARGET_FLAG_IS_DRAGGABLE) !== 0) {
            this._dragTarget = ptr;
            this._dragMoved = false;
            this._setDragging(ptr, true);
        } else {
            this.triggerEvent("IO_CLICK_TARGET", ptr);
        }
    }

    private _setDragging(ptr: number, dragging: boolean): void {
        const offset = ptr + CatnipWasmStructTarget.getMemberOffset("flags");
        const flags = this.runtimeModule.memory.getUint32(offset, true);
        const updated = dragging
            ? (flags | CATNIP_TARGET_FLAG_IS_DRAGGING)
            : (flags & ~CATNIP_TARGET_FLAG_IS_DRAGGING);
        this.runtimeModule.memory.setUint32(offset, updated, true);
    }

    /** Mouse move: the sensing position, plus dragging a held target.
     *  Only here updates the `_mouse_` query coordinates (the page posts
     *  moves; pick/up never rewrite them, matching scratch's posts). */
    public mouseMove(x: number, y: number): void {
        this._mouseX = x;
        this._mouseY = y;
        this.triggerEvent("IO_MOUSE_MOVE", x, y);

        if (this._dragTarget !== 0) {
            this._dragMoved = true;
            this.runtimeModule.functions.catnip_target_set_xy_force(x, y, this._dragTarget);
        }
    }

    /** Mouse up: end any drag, clicking the dragged target only if it did
     *  not actually move (scratch's wasDragged rule). */
    public mouseUp(): void {
        this.triggerEvent("IO_MOUSE_UP");

        if (this._dragTarget !== 0) {
            const ptr = this._dragTarget;
            this._dragTarget = 0;
            this._setDragging(ptr, false);
            if (!this._dragMoved)
                this.triggerEvent("IO_CLICK_TARGET", ptr);
        }
    }

    public triggerEvent<TEventID extends CatnipEventID>(event: TEventID, ...args: CatnipEventArgs<TEventID>): boolean {
        CatnipProjectModule._logger.assert(CatnipEvents[event].args.length === args.length);

        const eventLambda = this._events.get(event);
        if (eventLambda === undefined) return false;

        const encodedArgs: any[] = [];

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const argInfo = CatnipEventValueTypes[CatnipEvents[event].args[i]] as CatnipEventValueTypeInfo;
            encodedArgs.push(argInfo.encodeWASM(this.project, arg));
        }

        eventLambda(...(encodedArgs as any));

        return true;
    }

    public hasEvent(event: CatnipEventID): boolean {
        return this._events.has(event);
    }

    public start(): void {
        // scratch-vm's greenFlag calls stopAll first, whose first act is
        // disposing every clone; the threads of the originals are cleared by
        // the hat machinery itself. Clones from a previous run die here.
        this.runtimeModule.functions.catnip_clone_dispose_all(this.runtimeInstance.ptr);
        // greenFlag then resets the project timer and clears every target's
        // edge-activated hat values, so "when timer > N" re-arms per run.
        this.runtimeModule.functions.catnip_runtime_reset_timer(this.runtimeInstance.ptr);
        this.runtimeModule.functions.catnip_edge_hat_clear_all(this.runtimeInstance.ptr);
        // greenFlag also drops any pending ask-and-wait queue and its answer.
        this.runtimeModule.functions.catnip_sensing_ask_reset();
        this.triggerEvent("PROJECT_START");
    }

    /** Simulation steps (frames) per second. Rendering is independent of this. */
    public get stepRate(): number {
        return this._stepRate;
    }

    /**
     * Changes the simulation step rate at runtime. The per-step work budget
     * follows scratch-vm: 75% of the step interval (sequencer WORK_TIME).
     * The renderer keeps drawing on its own frame loop, so this only affects
     * how fast the simulation advances.
     */
    public setStepRate(stepRateHz: number): void {
        if (!Number.isFinite(stepRateHz) || stepRateHz <= 0)
            throw new Error(`Invalid step rate '${stepRateHz}'`);

        this._stepRate = stepRateHz;
        this.runtimeInstance.setMember("cfg_tick_time", catnipTickBudgetMs(stepRateHz));
    }

    public step(): void {
        // Edge-activated hats are polled before the tick, the order
        // scratch-vm's _step uses: startHats for them, then stepThreads.
        this.triggerEvent("PROJECT_FRAME");
        this.runtimeModule.functions.catnip_runtime_tick(this.runtimeInstance.ptr);
    }

    public frame(): void {
        // Clones come and go between frames; reconcile first so every array
        // below covers the slots the renderer now knows about.
        this._syncSlots();
        // Hand the renderer the current visual state of every target. The
        // buffer is handed over, not copied, so it is rebuilt every frame.
        this.runtimeModule.renderer.drawState(this._serializeDrawState());
        // Layer ranks only change when a layer op runs, so they go out on
        // their own message whenever a target's layer_gen moved.
        if (this._layerGenChanged())
            this.runtimeModule.renderer.layer(this._serializeLayers());
        // Bubbles likewise go out only when a target's bubble_gen moved.
        const bubbleUpdates = this._serializeBubbles();
        if (bubbleUpdates.length > 0)
            this.runtimeModule.renderer.bubble(bubbleUpdates);
        // Flush pen lines
        this.runtimeModule.functions.catnip_runtime_render_pen_flush(this.runtimeInstance.ptr);
        // Call the renderer
        this.runtimeModule.renderer.frame();
    }

    /** Packs every sprite's target state into DRAW_STATE_STRIDE floats each. */
    public getDrawState(): Float32Array {
        this._syncSlots();
        return this._serializeDrawState();
    }

    /** The layer rank of every target (index 0 = stage), sprites 1..n back to front. */
    public getLayers(): Int32Array {
        this._syncSlots();
        return this._serializeLayers();
    }

    /** One target's say/think bubble, as the renderer would show it. */
    public getBubble(index: number): { type: number, text: string } {
        const sprites = Array.from(this.project.sprites);
        if (index < 0 || index >= sprites.length)
            throw new Error(`No target at index ${index}.`);

        const target = sprites[index].defaultTarget.structWrapper;
        const ptr = target.getMember("bubble_text");
        if (ptr === 0)
            return { type: 0, text: "" };

        return { type: target.getMember("bubble_type"), text: this._readHString(ptr) };
    }

    /** Decodes an hstring living in wasm memory (header + UTF-16 units). */
    private _readHString(ptr: number): string {
        const headerSize = CatnipWasmStructHeapString.size;
        const bytelen = this.runtimeModule.memory.getUint32(
            ptr + CatnipWasmStructHeapString.getMemberOffset("bytelen"), true);
        const charBytes = bytelen - headerSize;
        if (charBytes <= 0) return "";

        const bytes = this.runtimeModule.memoryBytes;
        return UTF16.decode(bytes.buffer.slice(ptr + headerSize, ptr + headerSize + charBytes));
    }

    private _bubbleGenCache: Int32Array | null = null;

    /** Bubble changes since the last call — empty when nothing moved. */
    private _serializeBubbles(): CatnipBubbleUpdate[] {
        const gens = new Int32Array(this._slots.length);
        const updates: CatnipBubbleUpdate[] = [];

        for (let i = 0; i < this._slots.length; i++) {
            const target = this._slots[i];
            if (target === null) {
                gens[i] = -1;
                continue;
            }

            gens[i] = target.getMember("bubble_gen");

            if (this._bubbleGenCache !== null && i < this._bubbleGenCache.length && this._bubbleGenCache[i] === gens[i])
                continue;

            const ptr = target.getMember("bubble_text");
            updates.push({
                index: i,
                type: ptr === 0 ? 0 : target.getMember("bubble_type"),
                text: ptr === 0 ? "" : this._readHString(ptr),
            });
        }

        if (this._bubbleGenCache === null
            || this._bubbleGenCache.length !== gens.length
            || !this._bubbleGenCache.every((g, i) => g === gens[i]))
            this._bubbleGenCache = gens;
        return updates;
    }

    private _serializeLayers(): Int32Array {
        const ranks = new Int32Array(this._slots.length);

        for (let i = 0; i < this._slots.length; i++) {
            const target = this._slots[i];
            if (target !== null)
                ranks[i] = target.getMember("layer_rank");
        }

        return ranks;
    }

    private _layerGenCache: Int32Array | null = null;

    /** True when any target's layer_gen differs from the last sent state. */
    private _layerGenChanged(): boolean {
        const gens = new Int32Array(this._slots.length);

        for (let i = 0; i < this._slots.length; i++) {
            const target = this._slots[i];
            gens[i] = target === null ? -1 : target.getMember("layer_gen");
        }

        if (this._layerGenCache !== null
            && this._layerGenCache.length === gens.length
            && this._layerGenCache.every((g, i) => g === gens[i]))
            return false;

        this._layerGenCache = gens;
        return true;
    }

    private _serializeDrawState(): Float32Array {
        const state = new Float32Array(this._slots.length * DRAW_STATE_STRIDE);

        for (let i = 0; i < this._slots.length; i++) {
            const target = this._slots[i];
            if (target === null) continue;
            const base = i * DRAW_STATE_STRIDE;

            state[base + DRAW_STATE.x] = target.getMember("position_x");
            state[base + DRAW_STATE.y] = target.getMember("position_y");
            state[base + DRAW_STATE.direction] = target.getMember("direction");
            state[base + DRAW_STATE.size] = target.getMember("size");
            state[base + DRAW_STATE.costume] = target.getMember("costume");
            state[base + DRAW_STATE.visible] =
                (target.getMember("flags") & CATNIP_TARGET_FLAG_IS_VISIBLE) !== 0 ? 1 : 0;
            state[base + DRAW_STATE.effect_color] = target.getMember("effect_color");
            state[base + DRAW_STATE.effect_fisheye] = target.getMember("effect_fisheye");
            state[base + DRAW_STATE.effect_whirl] = target.getMember("effect_whirl");
            state[base + DRAW_STATE.effect_pixelate] = target.getMember("effect_pixelate");
            state[base + DRAW_STATE.effect_mosaic] = target.getMember("effect_mosaic");
            state[base + DRAW_STATE.effect_brightness] = target.getMember("effect_brightness");
            state[base + DRAW_STATE.effect_ghost] = target.getMember("effect_ghost");
            state[base + DRAW_STATE.rotation_style] = target.getMember("rotation_style");
        }

        return state;
    }

    public hasRunningThreads() : boolean {
        return this.runtimeInstance.getMember("num_active_threads") !== 0;
    }

    /** GC statistics for the last collection. Release builds have none. */
    public getGcStats(): CatnipRuntimeGcStats {
        if (this.runtimeInstance.getMember("gc_stats") === 0)
            throw new Error("This runtime was built without GC statistics (see CATNIP_GC_STATS).");

        return this.runtimeInstance.getMemberWrapper("gc_stats").getInner();
    }

}