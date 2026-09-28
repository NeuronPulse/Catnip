import { CatnipEventArgs, CatnipEventID, CatnipEventListener, CatnipEvents, CatnipEventValueTypeInfo, CatnipEventValueTypes } from "../CatnipEvents";
import { createLogger, Logger } from "../log";
import { CatnipProject } from "../runtime/CatnipProject";
import { CATNIP_DEFAULT_STEP_RATE, CatnipRuntimeModule, catnipTickBudgetMs } from "../runtime/CatnipRuntimeModule";
import { CatnipWasmStructRuntime } from "../wasm-interop/CatnipWasmStructRuntime";
import { WasmStructValue, WasmStructWrapper } from "../wasm-interop/wasm-types";
import { CatnipRuntimeGcStats, CatnipWasmStructRuntimeGcStats } from '../wasm-interop/CatnipWasmStructRuntimeGcStats';
import { DRAW_STATE, DRAW_STATE_STRIDE } from "./ICatnipRenderer";
import { CATNIP_TARGET_FLAG_IS_VISIBLE } from "../wasm-interop/CatnipWasmStructTarget";

export type CatnipProjectModuleEvent<TEvnetID extends CatnipEventID = CatnipEventID> = { id: TEvnetID, exportName: string };

export class CatnipProjectModule {
    private static readonly _logger: Logger = createLogger("CatnipProjectModule");

    public readonly project: CatnipProject;
    
    public readonly runtimeModule: CatnipRuntimeModule;
    public readonly runtimeInstance: WasmStructWrapper<typeof CatnipWasmStructRuntime>;

    public readonly instance: WebAssembly.Instance;
    private _events: Map<CatnipEventID, CatnipEventListener> = new Map();

    private _stepRate: number;
    
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
        this.runtimeModule.functions.catnip_runtime_tick(this.runtimeInstance.ptr);
    }

    public frame(): void {
        // Hand the renderer the current visual state of every target. The
        // buffer is handed over, not copied, so it is rebuilt every frame.
        this.runtimeModule.renderer.drawState(this._serializeDrawState());
        // Flush pen lines
        this.runtimeModule.functions.catnip_runtime_render_pen_flush(this.runtimeInstance.ptr);
        // Call the renderer
        this.runtimeModule.renderer.frame();
    }

    /** Packs every sprite's target state into DRAW_STATE_STRIDE floats each. */
    public getDrawState(): Float32Array {
        return this._serializeDrawState();
    }

    private _serializeDrawState(): Float32Array {
        const sprites = Array.from(this.project.sprites);
        const state = new Float32Array(sprites.length * DRAW_STATE_STRIDE);

        for (let i = 0; i < sprites.length; i++) {
            const target = sprites[i].defaultTarget.structWrapper;
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