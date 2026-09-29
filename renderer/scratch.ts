import RenderWebGL from "scratch-render";
import {
    CatnipBubbleUpdate,
    DRAW_STATE,
    DRAW_STATE_STRIDE,
    ICatnipRenderer,
    PEN_ATTRIBUTE_STRIDE,
} from "../src/runtime/ICatnipRenderer";

/** Mirrors scratch-vm/src/engine/stage-layering.js LAYER_GROUPS. */
const LAYER_GROUPS = ["background", "video", "pen", "sprite"];

/** The drawable effect names, in DRAW_STATE order after `visible`. */
const EFFECT_NAMES = [
    "color",
    "fisheye",
    "whirl",
    "pixelate",
    "mosaic",
    "brightness",
    "ghost",
] as const;

/** Static description of one target, as sent by the worker after compiling. */
export interface CatnipTargetRenderInfo {
    index: number,
    isStage: boolean,
    layerOrder: number,
    rotationStyle: "all around" | "left-right" | "don't rotate",
    costumeCount: number,
    name: string,
};

/** One costume's raw bytes plus the metadata needed to build its skin. */
export interface CatnipCostumeAsset {
    targetIndex: number,
    costumeIndex: number,
    dataFormat: string,
    bitmapResolution: number,
    rotationCenterX: number,
    rotationCenterY: number,
    data: ArrayBuffer,
};

/**
 * The page's renderer: a scratch-render RenderWebGL behind the ICatnipRenderer
 * the worker talks to. Targets and costumes arrive as messages once, every
 * frame carries a packed draw state, and pen batches are replayed onto a
 * scratch-render pen skin.
 */
export class CatnipScratchRenderer implements ICatnipRenderer {
    public readonly canvasElement: HTMLCanvasElement;
    private readonly _renderer: RenderWebGL;

    private _drawables: (number | undefined)[] = [];
    private _skins: Map<string, number> = new Map();
    private _appliedSkins: (number | undefined)[] = [];
    /** Sprite index per draw-state slot: clones share their sprite's skins. */
    private _skinTargetIndex: number[] = [];
    private _stageIndex: number = 0;

    private _penDrawableID: number | null = null;
    private _penSkinID: number | null = null;

    /** Current say/think bubble per target index, as the worker sent it. */
    private _bubbles: Map<number, { type: number, text: string }> = new Map();
    private _bubbleEls: Map<number, HTMLDivElement> = new Map();
    // Stage-space draw state per target, kept for bubble placement.
    private _drawX: number[] = [];
    private _drawY: number[] = [];
    private _drawVisible: boolean[] = [];

    public constructor() {
        this.canvasElement = document.getElementById("canvas") as HTMLCanvasElement;
        this._renderer = new RenderWebGL(this.canvasElement);
        this._renderer.setLayerGroupOrdering(LAYER_GROUPS);

        this._renderer.resize(this.canvasElement.clientWidth, this.canvasElement.clientHeight);
    }

    /** Creates the drawables, in Scratch's saved back-to-front order. */
    public initTargets(targets: CatnipTargetRenderInfo[]): void {
        // Scratch's layerOrder is the saved z-order: higher is in front. The
        // sprite group draws in creation order, so create them in layer order.
        const ordered = targets.slice().sort((a, b) => {
            if (a.isStage !== b.isStage) return a.isStage ? -1 : 1;
            if (a.isStage) return 0;
            return a.layerOrder - b.layerOrder;
        });

        for (const info of ordered) {
            const group = info.isStage ? "background" : "sprite";
            this._drawables[info.index] = this._renderer.createDrawable(group);
            this._skinTargetIndex[info.index] = info.index;
            if (info.isStage) this._stageIndex = info.index;
        }
    }

    /** A clone took a draw-state slot: give it a drawable of its sprite's group. */
    public cloneAdd(slot: number, spriteIndex: number): void {
        this._drawables[slot] = this._renderer.createDrawable("sprite");
        this._skinTargetIndex[slot] = spriteIndex;
        // The slot may be recycled from an earlier clone; its skin must be
        // re-applied to the fresh drawable.
        this._appliedSkins[slot] = undefined;
        this._drawX[slot] = 0;
        this._drawY[slot] = 0;
        this._drawVisible[slot] = false;
    }

    /** A clone's slot went empty (deleted or all clones disposed). */
    public cloneRemove(slot: number): void {
        const drawable = this._drawables[slot];
        if (drawable !== undefined) this._renderer.destroyDrawable(drawable, "sprite");

        this._drawables[slot] = undefined;
        this._appliedSkins[slot] = undefined;
        this._bubbles.delete(slot);

        const bubbleEl = this._bubbleEls.get(slot);
        if (bubbleEl !== undefined) {
            bubbleEl.remove();
            this._bubbleEls.delete(slot);
        }
    }

    /**
     * Picks the topmost visible target under a canvas-relative point in CSS
     * pixels and returns its index (the same indexing as the draw states);
     * falls back to the stage when nothing is hit, like scratch-vm's
     * mouse._pickTarget.
     */
    public pickTargetIndex(cssX: number, cssY: number): number {
        const drawableID = this._renderer.pick(cssX, cssY);
        if (drawableID !== -1) {
            const index = this._drawables.indexOf(drawableID);
            if (index !== -1) return index;
        }
        return this._stageIndex;
    }

    /** Builds the skin for one costume; SVGs are ready immediately, bitmaps decode asynchronously. */
    public addCostume(costume: CatnipCostumeAsset): void {
        const key = `${costume.targetIndex}:${costume.costumeIndex}`;

        if (costume.dataFormat === "svg") {
            const svg = new TextDecoder().decode(costume.data);
            const skinID = this._renderer.createSVGSkin(svg, [
                costume.rotationCenterX,
                costume.rotationCenterY,
            ]);
            this._skins.set(key, skinID);
            return;
        }

        const url = URL.createObjectURL(new Blob([costume.data], { type: "image/png" }));
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);

            const bitmap = document.createElement("canvas");
            bitmap.width = image.naturalWidth;
            bitmap.height = image.naturalHeight;
            bitmap.getContext("2d")!.drawImage(image, 0, 0);

            // The rotation center in the project file is in bitmap pixels;
            // the skin works in skin (stage) units, which are pixels / resolution.
            const resolution = costume.bitmapResolution;
            const skinID = this._renderer.createBitmapSkin(bitmap, resolution, [
                costume.rotationCenterX / resolution,
                costume.rotationCenterY / resolution,
            ]);
            this._skins.set(key, skinID);
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            console.error(`[catnip] failed to decode costume ${costume.targetIndex}:${costume.costumeIndex}`);
        };

        image.src = url;
    }


    /**
     * Applies bubble updates for targets whose bubble_gen changed: one DOM
     * overlay node per talking target, positioned over the canvas from the
     * latest draw state and hidden with its sprite.
     */
    public bubble(data: CatnipBubbleUpdate[]): void {
        for (const update of data) {
            if (update.type === 0 || update.text === "")
                this._bubbles.delete(update.index);
            else
                this._bubbles.set(update.index, { type: update.type, text: update.text });
        }

        for (const [index, bubble] of this._bubbles) {
            if (this._bubbleEls.has(index)) continue;
            const el = document.createElement("div");
            el.className = "catnip-bubble";
            el.style.position = "fixed";
            el.style.pointerEvents = "none";
            el.style.background = "#fff";
            el.style.border = "1.5px solid rgba(0, 0, 0, 0.35)";
            el.style.color = "#575e75";
            el.style.font = "14px/1.35 \"Helvetica Neue\", Helvetica, Arial, sans-serif";
            el.style.padding = "4px 9px";
            el.style.maxWidth = "340px";
            el.style.whiteSpace = "pre-wrap";
            el.style.wordBreak = "break-word";
            el.style.zIndex = "10";
            el.textContent = bubble.text;
            document.body.appendChild(el);
            this._bubbleEls.set(index, el);
        }

        for (const [index, el] of this._bubbleEls) {
            if (this._bubbles.has(index)) continue;
            el.remove();
            this._bubbleEls.delete(index);
        }

        this._layoutBubbles();
    }

    /** Moves each bubble above its sprite (flipping below near the top edge). */
    private _layoutBubbles(): void {
        const rect = this.canvasElement.getBoundingClientRect();
        const scaleX = rect.width / 480;
        const scaleY = rect.height / 360;

        for (const [index, bubble] of this._bubbles) {
            const el = this._bubbleEls.get(index);
            if (el === undefined) continue;

            el.textContent = bubble.text;

            if (this._drawVisible[index] === false) {
                el.style.display = "none";
                continue;
            }

            el.style.display = "block";
            // Scratch's bubble tails: a pointed box for say, a rounder one for think.
            el.style.borderRadius = bubble.type === 2 ? "18px" : "8px";

            const centerX = rect.left + (240 + (this._drawX[index] ?? 0)) * scaleX;
            const centerY = rect.top + (180 - (this._drawY[index] ?? 0)) * scaleY;

            const width = el.offsetWidth;
            const height = el.offsetHeight;
            let left = centerX - width / 2;
            left = Math.max(rect.left, Math.min(left, rect.right - width));

            // Above the sprite; flip below when the top would clip.
            let top = centerY - height / 2 - (30 + height / 2) * scaleY;
            if (top < rect.top + 2)
                top = centerY + height / 2 + 30 * scaleY;

            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
        }
    }

    /** Applies one packed draw state (see DRAW_STATE). */
    public applyDrawState(data: Float32Array): void {
        const targetCount = Math.floor(data.length / DRAW_STATE_STRIDE);

        for (let i = 0; i < targetCount; i++) {
            const drawable = this._drawables[i];
            if (drawable === undefined) continue;

            const base = i * DRAW_STATE_STRIDE;
            const x = data[base + DRAW_STATE.x];
            const y = data[base + DRAW_STATE.y];
            const direction = data[base + DRAW_STATE.direction];
            const size = data[base + DRAW_STATE.size];

            let renderedDirection = direction;
            let scaleX = size;
            const scaleY = size;

            switch (data[base + DRAW_STATE.rotation_style]) {
                case 1: // left-right
                    renderedDirection = 90;
                    if (direction < 0) scaleX = -size;
                    break;
                case 2: // don't rotate
                    renderedDirection = 90;
                    break;
            }

            this._renderer.updateDrawablePosition(drawable, [x, y]);
            this._renderer.updateDrawableDirectionScale(drawable, renderedDirection, [scaleX, scaleY]);
            this._renderer.updateDrawableVisible(drawable, data[base + DRAW_STATE.visible] !== 0);

            // Slots past the originals are clones, whose skin key is their
            // sprite's — same costumes, same skins.
            const spriteIndex = this._skinTargetIndex[i] ?? i;
            const skinKey = `${spriteIndex}:${data[base + DRAW_STATE.costume]}`;
            const skinID = this._skins.get(skinKey);
            if (skinID !== undefined && this._appliedSkins[i] !== skinID) {
                this._renderer.updateDrawableSkinId(drawable, skinID);
                this._appliedSkins[i] = skinID;
            }

            for (let e = 0; e < EFFECT_NAMES.length; e++) {
                this._renderer.updateDrawableEffect(
                    drawable,
                    EFFECT_NAMES[e],
                    data[base + DRAW_STATE.effect_color + e]
                );
            }

            this._drawX[i] = x;
            this._drawY[i] = y;
            this._drawVisible[i] = data[base + DRAW_STATE.visible] !== 0;
        }

        if (this._bubbles.size > 0) this._layoutBubbles();
    }

    /** Stages the pen layer on first use: pen drawing arrives as batches of segments. */
    private _ensurePenLayer(): number {
        if (this._penDrawableID === null || this._penSkinID === null) {
            this._penDrawableID = this._renderer.createDrawable("pen");
            this._penSkinID = this._renderer.createPenSkin();
            this._renderer.updateDrawableSkinId(this._penDrawableID, this._penSkinID);
        }
        return this._penSkinID;
    }

    public penDrawLines(data: Float32Array, length: number): void {
        const penSkin = this._ensurePenLayer();

        for (let i = 0; i < length; i++) {
            const o = i * PEN_ATTRIBUTE_STRIDE;

            // catnip_pen_line (module/catnip_runtime.h): color rgba, thickness,
            // length, then the start point and the delta to the end point.
            this._renderer.penLine(penSkin, {
                diameter: data[o + 4],
                color4f: [data[o], data[o + 1], data[o + 2], data[o + 3]],
            },
                data[o + 6], data[o + 7],
                data[o + 6] + data[o + 8], data[o + 7] + data[o + 9]);
        }
    }

    public penEraseAll(): void {
        this._renderer.penClear(this._ensurePenLayer());
    }

    public drawState(data: Float32Array): void {
        this.applyDrawState(data);
    }

    public layer(data: Int32Array): void {
        this.applyLayer(data);
    }

    /**
     * Re-sorts the sprite drawables by layer rank (index 0 = stage, which is
     * never reordered). The sprite group is contiguous in the global draw
     * list, so its first slot is the lowest order any sprite currently holds;
     * each drawable then moves to start + its sorted position, which is where
     * setDrawableOrder's absolute indexing expects it.
     */
    public applyLayer(data: Int32Array): void {
        const order: number[] = [];
        let start = Infinity;

        for (let i = 1; i < data.length; i++) {
            const drawable = this._drawables[i];
            if (drawable === undefined) continue;
            order.push(i);
            const current = this._renderer.getDrawableOrder(drawable);
            if (current >= 0 && current < start) start = current;
        }

        if (!isFinite(start)) return;

        order.sort((a, b) => data[a] - data[b]);

        for (let pos = 0; pos < order.length; pos++) {
            const drawable = this._drawables[order[pos]];
            if (drawable !== undefined)
                this._renderer.setDrawableOrder(drawable, start + pos, "sprite");
        }
    }

    /** Draws one frame; the page calls this from its rAF loop when dirty. */
    public frame(): void {
        this._renderer.draw();
    }
}
