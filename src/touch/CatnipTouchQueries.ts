/**
 * The sensing touch queries — ports of scratch-render's CPU paths for
 * `touching (edge|mouse-pointer|sprite)`, `touching color` and
 * `color is touching color` (RenderWebGL.js `drawableTouching`,
 * `isTouchingColor`, `isTouchingDrawables` + the `_candidates*` helpers) and
 * scratch-vm's dispatch in `rendered-target.js isTouchingObject`.
 *
 * How this maps scratch-render's model onto catnip:
 * - One `CatnipDrawable` per live target (wasm pointer), holding the model
 *   transform, cached convex hull and the CPU sampling state; state is
 *   re-read from the target struct on every query (scratch mutates its
 *   drawables from the VM instead).
 * - Drawables come from the draw-state slots, ordered by `layer_rank`
 *   ascending = scratch's `_drawList` (stage 0, sprites 1..n, renumbered by
 *   the layer ops exactly like setDrawableOrder). Candidates iterate
 *   backwards, top-most first, the way `_candidatesTouching` does.
 * - Costumes are pre-decoded in `warmup()` (`project.readAsset`): PNG
 *   through `CatnipImageDecode`, SVG rasterized to a silhouette for the
 *   "1x" mip with async upgrades when a query wants a sharper mip
 *   (SVGSkin.createMIP is synchronous there; the result converges).
 *
 * Deliberate deviations (also in PLAN.md):
 * - Always the CPU path: scratch's Automatic GPU fallback (bounds pixels ×
 *   candidates >= 40000) runs the shader, whose mask tolerance differs from
 *   the CPU `maskMatches`.
 * - Pen strokes are not candidates (the page draws them on a skin the
 *   worker never sees); scratch includes the pen drawable.
 * - In node (tests) SVG costumes have no rasterizer -> silhouette null ->
 *   their queries answer false (bitmaps are pure JS and exact).
 * - Mouse coordinates update on `mousemove` only; scratch-gui also posts
 *   coordinates with mousedown/up (touch taps without a move differ).
 */
import { createLogger } from "../log";
import type { CatnipProjectModule } from "../runtime/CatnipProjectModule";
import { colorMatches, maskMatches, toRgbColorList } from "./CatnipColor";
import { CatnipDrawable, CatnipSkin } from "./CatnipDrawable";
import { CatnipSilhouette } from "./CatnipSilhouette";
import {
    decodePng,
    parseSvgSize,
    rasterToSilhouette,
    svgRasterize,
    upscaleNearest2x
} from "./CatnipImageDecode";
import { EFFECT_MASK_GHOST } from "./CatnipEffects";
import { CatnipRectangle } from "./CatnipRectangle";
import {
    CATNIP_TARGET_FLAG_IS_STAGE,
    CATNIP_TARGET_FLAG_IS_VISIBLE
} from "../wasm-interop/CatnipWasmStructTarget";

const logger = createLogger("CatnipTouch");

const STAGE_HALF_WIDTH = 480 / 2;
const STAGE_HALF_HEIGHT = 360 / 2;

/** scratch-render's `_backgroundColor3b`: never written (no setBackgroundColor
 *  callers in scratch-vm), so the black-query special case tests pure black. */
const BACKGROUND_COLOR: [number, number, number] = [0, 0, 0];

/**
 * One costume's query skin: scratch's Skin/BitmapSkin/SVGSkin data that the
 * drawables need (size + rotation center in scratch units, silhouette).
 */
class CatnipTouchSkin implements CatnipSkin {
    public readonly size: [number, number];
    public readonly rotationCenter: [number, number];
    public readonly isSvg: boolean;
    /** Straight-alpha pixel map; null until rasterized (or failed). */
    public silhouette: CatnipSilhouette | null = null;

    /** SVGSkin state for on-demand sharper mips (async here). */
    private readonly _svgText: string | null;
    private readonly _maxTextureScale: number;
    private _largestMipScale: number;
    private _upgradePending = false;

    public constructor(desc: {
        size: [number, number],
        rotationCenter: [number, number],
        isSvg: boolean,
        silhouette: CatnipSilhouette | null,
        svgText?: string,
        maxTextureScale?: number,
        largestMipScale?: number
    }) {
        this.size = desc.size;
        this.rotationCenter = desc.rotationCenter;
        this.isSvg = desc.isSvg;
        this.silhouette = desc.silhouette;
        this._svgText = desc.svgText ?? null;
        this._maxTextureScale = desc.maxTextureScale ?? 1;
        this._largestMipScale = desc.largestMipScale ?? 0;
    }

    /**
     * Skin.updateSilhouette: bitmap skins are fixed; SVGSkin keeps the
     * silhouette of the largest mip it has ever seen and creates sharper
     * ones on demand (synchronously in scratch, async here).
     */
    public silhouetteFor(scale: number): CatnipSilhouette | null {
        if (!this.isSvg || this._svgText === null) return this.silhouette;

        const wanted = this._mipScaleFor(scale);
        if (wanted > this._largestMipScale && !this._upgradePending) {
            this._upgradePending = true;
            const svgText = this._svgText;
            svgRasterize(svgText, wanted).then(raster => {
                this._upgradePending = false;
                if (raster !== null && wanted > this._largestMipScale) {
                    this.silhouette = rasterToSilhouette(raster);
                    this._largestMipScale = wanted;
                }
            }).catch(() => {
                this._upgradePending = false;
            });
        }
        return this.silhouette;
    }

    /** SVGSkin.getTexture's mip pick: level = max(ceil(log2(scale/100)) + 8, 0). */
    private _mipScaleFor(scale: number): number {
        const requestedScale = Math.min(Math.abs(scale) / 100, this._maxTextureScale);
        const mipLevel = Math.max(Math.ceil(Math.log2(requestedScale)) + 8, 0);
        return Math.pow(2, mipLevel - 8);
    }
}

/** A candidate drawable in top-most-first order with its intersection rect. */
interface Candidate {
    drawable: CatnipDrawable;
    intersection?: CatnipRectangle;
}

export class CatnipTouchQueries {
    private readonly _module: CatnipProjectModule;

    /** `${spriteIndex}:${costumeIndex}` -> query skin. */
    private readonly _skins = new Map<string, CatnipTouchSkin>();
    private readonly _drawables = new Map<number, CatnipDrawable>();
    private _warmedUp = false;

    // Per-query scratch buffers (single threaded, like scratch's module
    // level statics: `__isTouchingDrawablesPoint` & co).
    private readonly _point: number[] = [0, 0];
    private readonly _selfColor = new Uint8ClampedArray(4);
    private readonly _candidateColor = new Uint8ClampedArray(4);
    private readonly _color3b = new Uint8ClampedArray(3);
    private readonly _unionRect = new CatnipRectangle();

    public constructor(module: CatnipProjectModule) {
        this._module = module;
    }

    /**
     * Pre-decodes every costume's silhouette. Must run while the asset zip
     * is still readable — worker.ts calls it after the costume transfer
     * build and before `clearAssetCache`.
     */
    public async warmup(): Promise<void> {
        if (this._warmedUp) return;
        this._warmedUp = true;

        let spriteIndex = 0;
        for (const sprite of this._module.project.sprites) {
            const index = spriteIndex++;
            for (const costume of sprite.costumes) {
                const key = `${index}:${costume.index}`;
                if (this._skins.has(key)) continue;

                let skin: CatnipTouchSkin;
                try {
                    const bytes = await this._module.project.readAsset(costume.md5ext);
                    skin = costume.dataFormat === "svg"
                        ? await this._buildSvgSkin(costume, bytes)
                        : this._buildBitmapSkin(costume, bytes);
                } catch (e) {
                    // A missing costume must not poison the queries: an empty
                    // skin simply never touches (same as an unloaded one).
                    logger.warn(`touch skin '${costume.md5ext}' unavailable: ${e}`);
                    skin = new CatnipTouchSkin({
                        size: [0, 0],
                        rotationCenter: [0, 0],
                        isSvg: costume.dataFormat === "svg",
                        silhouette: null
                    });
                }
                this._skins.set(key, skin);
            }
        }
    }

    /**
     * load-costume's bitmap path: the texture is normalized to resolution 2
     * (v2BitmapAdapter upscale for res-1 assets) and the drawable works in
     * scratch units = raw / resolution, so skin.size = raw / resolution and
     * the rotation center is the project.json value / resolution.
     */
    private _buildBitmapSkin(costume: { bitmapResolution: number, rotationCenterX: number, rotationCenterY: number }, bytes: Uint8Array): CatnipTouchSkin {
        const resolution = costume.bitmapResolution || 1;
        const raw = decodePng(bytes);
        const texture = resolution === 1 ? upscaleNearest2x(raw) : raw;
        return new CatnipTouchSkin({
            size: [raw.width / resolution, raw.height / resolution],
            rotationCenter: [costume.rotationCenterX / resolution, costume.rotationCenterY / resolution],
            isSvg: false,
            silhouette: rasterToSilhouette(texture)
        });
    }

    /**
     * load-costume's SVG path: size from the viewBox (SVGSkin.setSVG) and
     * the rotation center shifted by the viewBox origin (scratch-render
     * PR #90). The silhouette is the "1x" mip; sharper mips refine async.
     */
    private async _buildSvgSkin(costume: { rotationCenterX: number, rotationCenterY: number }, bytes: Uint8Array): Promise<CatnipTouchSkin> {
        const svgText = new TextDecoder("utf-8").decode(bytes);
        const view = parseSvgSize(svgText);

        // SVGSkin's `_maxTextureScale`: the largest power-of-two scale whose
        // longest side still fits MAX_TEXTURE_DIMENSION (2048).
        const maxDimension = Math.ceil(Math.max(view.width, view.height));
        let maxTextureScale = 1;
        for (let testScale = 2; maxDimension * testScale <= 2048; testScale *= 2)
            maxTextureScale = testScale;

        const raster = await svgRasterize(svgText, 1);
        return new CatnipTouchSkin({
            size: [view.width, view.height],
            rotationCenter: [costume.rotationCenterX - view.x, costume.rotationCenterY - view.y],
            isSvg: true,
            silhouette: raster === null ? null : rasterToSilhouette(raster),
            svgText,
            maxTextureScale,
            largestMipScale: raster === null ? 0 : 1
        });
    }

    /** scratch-vm's `isTouchingObject`: mouse / edge / named sprite. */
    public isTouchingObject(selfPtr: number, option: string): boolean {
        this._module.syncTouchSlots();
        if (option === "_mouse_") return this._isTouchingMouse(selfPtr);
        if (option === "_edge_") return this._isTouchingEdge(selfPtr);
        return this._isTouchingSprite(selfPtr, option);
    }

    /** RenderedTarget.isTouchingEdge: the hull bounds escaping the stage. */
    private _isTouchingEdge(selfPtr: number): boolean {
        const drawable = this._drawableFor(selfPtr);
        if (drawable === null) return false;

        const bounds = drawable.getBounds();
        return bounds.left < -STAGE_HALF_WIDTH ||
            bounds.right > STAGE_HALF_WIDTH ||
            bounds.top > STAGE_HALF_HEIGHT ||
            bounds.bottom < -STAGE_HALF_HEIGHT;
    }

    /**
     * RenderedTarget.isTouchingObject('_mouse_') -> renderer.drawableTouching:
     * a single scratch-space pixel. The caller hands us unrounded scratch
     * coordinates; `clientSpaceToScratchBounds(cx, cy, 1, 1)` collapses to
     * `x = floor(sx)`, `y = ceil(sy)` (verified through the full roundtrip,
     * canvas size included). Before the first mouse move both scratch and
     * catnip are NaN -> the loop never runs -> false.
     */
    private _isTouchingMouse(selfPtr: number): boolean {
        const drawable = this._drawableFor(selfPtr);
        if (drawable === null) return false;

        drawable.updateCPURenderAttributes();
        const x0 = Math.floor(this._module.mouseX);
        const y0 = Math.ceil(this._module.mouseY);
        for (let y = y0; y <= y0; y++) {
            for (let x = x0; x <= x0; x++) {
                this._point[0] = x;
                this._point[1] = y;
                if (drawable.isTouching(this._point)) return true;
            }
        }
        return false;
    }

    /**
     * RenderedTarget.isTouchingSprite: the named sprite's targets (original
     * + clones — sprite.clones includes the original), dragging ones dropped
     * so a dragged sprite can't be detected — scratch 2 behavior.
     */
    private _isTouchingSprite(selfPtr: number, spriteName: string): boolean {
        const spriteIndex = this._spriteIndexByName(spriteName);
        if (spriteIndex < 0) return false;

        const self = this._drawableFor(selfPtr);
        if (self === null) return false;

        const dragPtr = this._module.dragTargetPtr;
        const candidates = this._collectCandidates(slot =>
            this._module.getSlotSpriteIndex(slot) === spriteIndex &&
            this._candidatePtr(slot) !== dragPtr);
        this._pruneCandidates(candidates, self);

        // An invisible (or skinless) self touches nothing.
        if (candidates.length === 0 || !self.visible) return false;

        const bounds = candidates[0].intersection!;
        self.updateCPURenderAttributes();

        // x outer / y inner, exactly like isTouchingDrawables.
        for (let x = bounds.left; x <= bounds.right; x++) {
            this._point[0] = x;
            for (let y = bounds.bottom; y <= bounds.top; y++) {
                this._point[1] = y;
                if (self.isTouching(this._point)) {
                    for (const candidate of candidates) {
                        if (candidate.drawable.isTouching(this._point)) return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * RenderedTarget.isTouchingColor (no mask) and colorIsTouchingColor
     * (mask) — both are `renderer.isTouchingColor(drawable, color, mask?)`.
     */
    public isTouchingColor(selfPtr: number, color: string, mask?: string): boolean {
        const color3b = toRgbColorList(color);
        const mask3b = mask === undefined ? null : toRgbColorList(mask);

        this._module.syncTouchSlots();
        const self = this._drawableFor(selfPtr);
        if (self === null) return false;

        const selfBounds = this._touchingBounds(self);
        const candidates = selfBounds === null ? [] : this._collectCandidates();
        if (selfBounds !== null) this._pruneCandidates(candidates, self, selfBounds);

        let bounds: CatnipRectangle;
        if (colorMatches(color3b, BACKGROUND_COLOR, 0)) {
            // Black queries the whole drawable: the (black) background spans
            // the stage, so candidate bounds would miss self-only pixels.
            if (selfBounds === null) return false;
            bounds = selfBounds;
        } else if (candidates.length === 0) {
            return false;
        } else {
            // The union of the candidate intersections (scratch unions only
            // the intersections, all inside selfBounds).
            bounds = candidates[0].intersection!;
            for (let i = 1; i < candidates.length; i++)
                bounds = CatnipRectangle.union(bounds, candidates[i].intersection!, this._unionRect);
        }

        const hasMask = mask3b !== null;
        // Masked drawable ignores the ghost effect.
        const effectMask = ~EFFECT_MASK_GHOST;

        self.updateCPURenderAttributes();

        // Scratch space, +y is top.
        for (let y = bounds.bottom; y <= bounds.top; y++) {
            for (let x = bounds.left; x <= bounds.right; x++) {
                this._point[0] = x;
                this._point[1] = y;
                const gate = hasMask
                    ? maskMatches(self.sampleColor4b(this._point, this._selfColor, effectMask), mask3b!)
                    : self.isTouching(this._point);
                if (gate) {
                    this._sampleColor3b(candidates);
                    if (colorMatches(this._color3b, color3b, 0)) return true;
                }
            }
        }
        return false;
    }

    /** `color is touching color`: target color under the mask color. */
    public isColorTouchingColor(selfPtr: number, color: string, mask: string): boolean {
        return this.isTouchingColor(selfPtr, color, mask);
    }

    /**
     * RenderWebGL._touchingBounds: the drawable clamped to the stage and
     * snapped to integers; null when there is no skin or no area to query.
     * (`skin.getTexture` is scratch's "no texture yet" check — an SVG skin
     * before its image loads; our silhouettes are warm before any query in
     * the browser, and a null silhouette fails every pixel gate anyway.)
     */
    private _touchingBounds(drawable: CatnipDrawable): CatnipRectangle | null {
        if (drawable.skin === null) return null;

        const bounds = drawable.getBounds();
        bounds.clamp(-STAGE_HALF_WIDTH, STAGE_HALF_WIDTH, -STAGE_HALF_HEIGHT, STAGE_HALF_HEIGHT);
        bounds.snapToInt();
        if (bounds.width === 0 || bounds.height === 0) return null;
        return bounds;
    }

    /**
     * The visible+skinned drawables in draw order (back to front), optionally
     * filtered by the caller (sprite name / drag). layer_rank ascending with
     * a stable sort keeps the clone ties in slot order, mirroring
     * `_visibleDrawList`; the list is then walked backwards = top-most first,
     * like `_candidatesTouching`.
     */
    private _collectCandidates(filter?: (slot: number) => boolean): Candidate[] {
        const slots: number[] = [];
        for (let slot = 0; slot < this._module.slotCount; slot++) {
            if (this._module.getSlot(slot) === null) continue;
            if (filter !== undefined && !filter(slot)) continue;
            slots.push(slot);
        }
        slots.sort((a, b) => this._module.getSlot(a)!.getMember("layer_rank")
            - this._module.getSlot(b)!.getMember("layer_rank"));

        const candidates: Candidate[] = [];
        for (let i = slots.length - 1; i >= 0; i--) {
            const drawable = this._drawableForSlot(slots[i]);
            // `_visibleDrawList` filters invisibles; `_candidatesTouching`
            // requires a skin too (text bubbles have neither role here).
            if (drawable === null || !drawable.visible || drawable.skin === null) continue;
            candidates.push({ drawable });
        }
        return candidates;
    }

    /**
     * `_candidatesTouching`: drop self, refresh the CPU attributes, snap the
     * candidate bounds and keep the ones intersecting self bounds (null
     * bounds empties the list, exactly like the early `return result`).
     */
    private _pruneCandidates(candidates: Candidate[], self: CatnipDrawable, selfBounds?: CatnipRectangle): void {
        const bounds = selfBounds ?? this._touchingBounds(self);
        if (bounds === null) {
            candidates.length = 0;
            return;
        }

        let kept = 0;
        for (const candidate of candidates) {
            if (candidate.drawable === self) continue;
            candidate.drawable.updateCPURenderAttributes();
            const candidateBounds = candidate.drawable.getBounds();
            candidateBounds.snapToInt();
            if (bounds.intersects(candidateBounds)) {
                candidate.intersection = CatnipRectangle.intersect(bounds, candidateBounds);
                candidates[kept++] = candidate;
            }
        }
        candidates.length = kept;
    }

    /**
     * RenderWebGL.sampleColor3b: blend the candidates top-down (premultiplied
     * over, `gl.ONE, gl.ONE_MINUS_SRC_ALPHA`) and fall back to white when
     * everything was transparent — scratch's clear color for touch queries.
     */
    private _sampleColor3b(candidates: Candidate[]): void {
        const dst = this._color3b;
        dst.fill(0);
        let blendAlpha = 1;
        for (let index = 0; blendAlpha !== 0 && index < candidates.length; index++) {
            candidates[index].drawable.sampleColor4b(this._point, this._candidateColor);
            dst[0] += this._candidateColor[0] * blendAlpha;
            dst[1] += this._candidateColor[1] * blendAlpha;
            dst[2] += this._candidateColor[2] * blendAlpha;
            blendAlpha *= 1 - (this._candidateColor[3] / 255);
        }
        dst[0] += blendAlpha * 255;
        dst[1] += blendAlpha * 255;
        dst[2] += blendAlpha * 255;
    }

    /** runtime.getSpriteTargetByName: first non-stage sprite with the name. */
    private _spriteIndexByName(name: string): number {
        let index = 0;
        for (const sprite of this._module.project.sprites) {
            const flags = sprite.defaultTarget.structWrapper.getMember("flags");
            if ((flags & CATNIP_TARGET_FLAG_IS_STAGE) === 0 && sprite.name === name)
                return index;
            index++;
        }
        return -1;
    }

    private _candidatePtr(slot: number): number {
        const wrapper = this._module.getSlot(slot);
        return wrapper === null ? 0 : wrapper.ptr;
    }

    /** The drawable for a target pointer, with its state refreshed from wasm. */
    private _drawableFor(ptr: number): CatnipDrawable | null {
        const slot = this._module.findSlotByPtr(ptr);
        if (slot < 0) return null;
        return this._drawableForSlot(slot);
    }

    private _drawableForSlot(slot: number): CatnipDrawable | null {
        const wrapper = this._module.getSlot(slot);
        if (wrapper === null) return null;

        const flags = wrapper.getMember("flags");
        const spriteIndex = this._module.getSlotSpriteIndex(slot);
        const costume = wrapper.getMember("costume");
        const skinKey = `${spriteIndex}:${costume}`;
        const skin = this._skins.get(skinKey) ?? null;

        let drawable = this._drawables.get(wrapper.ptr);
        if (drawable === undefined) {
            drawable = new CatnipDrawable();
            this._drawables.set(wrapper.ptr, drawable);
        }

        drawable.applyState({
            x: wrapper.getMember("position_x"),
            y: wrapper.getMember("position_y"),
            direction: wrapper.getMember("direction"),
            size: wrapper.getMember("size"),
            visible: (flags & CATNIP_TARGET_FLAG_IS_VISIBLE) !== 0,
            rotationStyle: wrapper.getMember("rotation_style"),
            effects: {
                color: wrapper.getMember("effect_color"),
                fisheye: wrapper.getMember("effect_fisheye"),
                whirl: wrapper.getMember("effect_whirl"),
                pixelate: wrapper.getMember("effect_pixelate"),
                mosaic: wrapper.getMember("effect_mosaic"),
                brightness: wrapper.getMember("effect_brightness"),
                ghost: wrapper.getMember("effect_ghost")
            },
            skin,
            costumeKey: skinKey
        });
        return drawable;
    }
}
