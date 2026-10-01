/**
 * Port of scratch-render's Drawable (src/Drawable.js) — just the CPU side
 * needed by the touch queries: the model transform, its analytic inverse,
 * bounds (convex hull + AABB), and the per-pixel touch/color sampling.
 *
 * Deviations, all deliberate:
 * - The 4x4 matrix inverse is computed analytically as a 2D affine inverse
 *   instead of twgl.m4.inverse; for these matrices (m[3]=m[7]=0, m[15]=1)
 *   the results are identical.
 * - `hull.js` simplification of the convex hull is skipped: the chain above
 *   already yields a convex polygon and removing collinear points cannot
 *   change the AABB.
 * - Convex hull points come from `silhouette.isTouchingLinear` over the
 *   skin-unit grid, exactly like RenderWebGL._getConvexHullPointsForDrawable
 *   (without its final hull.js pass).
 */
import { CatnipRectangle } from "./CatnipRectangle";
import { CatnipSilhouette } from "./CatnipSilhouette";
import {
    CatnipEffectState,
    EFFECT_MASK_FISHEYE,
    EFFECT_MASK_MOSAIC,
    EFFECT_MASK_PIXELATE,
    EFFECT_MASK_WHIRL,
    effectsFromRaw,
    transformColor,
    transformPoint
} from "./CatnipEffects";

const FLOATING_POINT_ERROR_ALLOWANCE = 1e-6;

/** What a drawable needs from its costume's skin (scratch Skin API subset). */
export interface CatnipSkin {
    /** Native size in scratch units — BitmapSkin: texture / resolution. */
    readonly size: readonly [number, number];
    /** Rotation center in scratch units (same units as size). */
    readonly rotationCenter: readonly [number, number];
    readonly isSvg: boolean;
    /**
     * Silhouette for a drawable scale (skin.updateSilhouette): bitmap skins
     * are fixed, SVG skins may refine asynchronously to a sharper mip.
     */
    silhouetteFor(scale: number): CatnipSilhouette | null;
}

/** Raw per-target visual state, read live from the wasm target struct. */
export interface CatnipDrawableState {
    x: number;
    y: number;
    direction: number;
    /** Scale in scratch percent (target size field). */
    size: number;
    visible: boolean;
    /** 0 all around, 1 left-right, 2 don't rotate (CATNIP_ROTATION_STYLE_*). */
    rotationStyle: number;
    effects: {
        color: number,
        fisheye: number,
        whirl: number,
        pixelate: number,
        mosaic: number,
        brightness: number,
        ghost: number
    };
    skin: CatnipSkin | null;
    /**
     * Identity of the costume behind the skin; bumping it drops the cached
     * convex hull the way `_skinWasAltered` does in scratch.
     */
    costumeKey: string;
}

export class CatnipDrawable {
    public visible = true;
    public isTouching: (vec: ArrayLike<number>) => boolean = () => false;

    private _position: [number, number] = [0, 0];
    private _scale: [number, number] = [100, 100];
    private _direction = 90;
    private _rotationStyle = 0;
    private _effects: CatnipEffectState = effectsFromRaw({
        color: 0, fisheye: 0, whirl: 0, pixelate: 0, mosaic: 0, brightness: 0, ghost: 0
    });
    private _skin: CatnipSkin | null = null;
    private _costumeKey = "";

    private readonly _model = new Float64Array(16);
    private readonly _inverse = new Float64Array(16);
    private _transformDirty = true;
    private _inverseDirty = true;

    /** Texture-space convex hull in skin units, cached per costume+shape. */
    private _hull: number[][] | null = null;
    private _hullShapeKey = "";
    private _hullSilhouette: CatnipSilhouette | null = null;

    private readonly _local: [number, number] = [0, 0];

    /**
     * Copies the live target state. Scalar compares decide the dirty flags —
     * the touch queries call this once per query, not per pixel.
     */
    public applyState(state: CatnipDrawableState): void {
        if (state.x !== this._position[0] || state.y !== this._position[1]) {
            this._position[0] = state.x;
            this._position[1] = state.y;
            this._transformDirty = true;
        }
        if (state.size !== this._scale[0] || state.size !== this._scale[1]) {
            // The target's size is a uniform scratch-percent scale.
            this._scale[0] = state.size;
            this._scale[1] = state.size;
            this._transformDirty = true;
        }
        if (state.direction !== this._direction) {
            this._direction = state.direction;
            this._transformDirty = true;
        }
        if (state.rotationStyle !== this._rotationStyle) {
            this._rotationStyle = state.rotationStyle;
            this._transformDirty = true;
        }
        this.visible = state.visible;

        const raw = state.effects;
        const effects = effectsFromRaw(raw);
        if (effects.enabledEffects !== this._effects.enabledEffects ||
            effects.u_color !== this._effects.u_color ||
            effects.u_fisheye !== this._effects.u_fisheye ||
            effects.u_whirl !== this._effects.u_whirl ||
            effects.u_pixelate !== this._effects.u_pixelate ||
            effects.u_mosaic !== this._effects.u_mosaic ||
            effects.u_brightness !== this._effects.u_brightness ||
            effects.u_ghost !== this._effects.u_ghost) {
            this._effects = effects;
        }

        if (state.skin !== this._skin) this._skin = state.skin;
        if (state.costumeKey !== this._costumeKey) {
            this._costumeKey = state.costumeKey;
            this._hull = null;
        }
    }

    public get effects(): CatnipEffectState {
        return this._effects;
    }

    public get skin(): CatnipSkin | null {
        return this._skin;
    }

    public get scale(): readonly [number, number] {
        return this._scale;
    }

    public get direction(): number {
        return this._direction;
    }

    /** Drawable._calculateTransform — column-major 4x4, 2D affine part only. */
    private _calculateTransform(): void {
        const rotation = (270 - this._direction) * Math.PI / 180;
        const c = Math.cos(rotation);
        const s = Math.sin(rotation);

        const skin = this._skin;
        const skinSize = skin !== null ? skin.size : [0, 0];
        const rotationCenter = skin !== null ? skin.rotationCenter : [0, 0];

        // rotationAdjusted = (rotationCenter - skinSize/2) * scale / 100,
        // y flipped into scratch's +y-up space.
        const adjusted0 = ((rotationCenter[0] - (skinSize[0] / 2)) * this._scale[0]) / 100;
        const adjusted1 = (((rotationCenter[1] - (skinSize[1] / 2)) * this._scale[1]) / 100) * -1;
        const skinScale0 = (skinSize[0] * this._scale[0]) / 100;
        const skinScale1 = (skinSize[1] * this._scale[1]) / 100;

        const m = this._model;
        m[0] = skinScale0 * c;
        m[1] = skinScale0 * s;
        m[2] = 0;
        m[3] = 0;
        m[4] = skinScale1 * -s;
        m[5] = skinScale1 * c;
        m[6] = 0;
        m[7] = 0;
        m[8] = 0;
        m[9] = 0;
        m[10] = 1;
        m[11] = 0;
        m[12] = (c * adjusted0) + (-s * adjusted1) + this._position[0];
        m[13] = (s * adjusted0) + (c * adjusted1) + this._position[1];
        m[14] = 0;
        m[15] = 1;

        this._transformDirty = false;
        this._inverseDirty = true;
    }

    /**
     * twgl.m4.inverse, ported operation-for-operation: `updateMatrix` inverts
     * the model with twgl's full 4x4 cofactor path, and the touch results are
     * only pixel-stable if the same operations run in the same order (the
     * local position feeds floor() right at texel boundaries). The structure
     * above makes the algebraic 2D inverse equivalent, but not bit-identical.
     */
    private _updateInverse(): void {
        const m = this._model;
        const dst = this._inverse;

        const m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3];
        const m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7];
        const m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11];
        const m30 = m[12], m31 = m[13], m32 = m[14], m33 = m[15];

        const tmp0 = m22 * m33;
        const tmp1 = m32 * m23;
        const tmp2 = m12 * m33;
        const tmp3 = m32 * m13;
        const tmp4 = m12 * m23;
        const tmp5 = m22 * m13;
        const tmp6 = m02 * m33;
        const tmp7 = m32 * m03;
        const tmp8 = m02 * m23;
        const tmp9 = m22 * m03;
        const tmp10 = m02 * m13;
        const tmp11 = m12 * m03;
        const tmp12 = m20 * m31;
        const tmp13 = m30 * m21;
        const tmp14 = m10 * m31;
        const tmp15 = m30 * m11;
        const tmp16 = m10 * m21;
        const tmp17 = m20 * m11;
        const tmp18 = m00 * m31;
        const tmp19 = m30 * m01;
        const tmp20 = m00 * m21;
        const tmp21 = m20 * m01;
        const tmp22 = m00 * m11;
        const tmp23 = m10 * m01;

        const t0 = (tmp0 * m11 + tmp3 * m21 + tmp4 * m31) -
            (tmp1 * m11 + tmp2 * m21 + tmp5 * m31);
        const t1 = (tmp1 * m01 + tmp6 * m21 + tmp9 * m31) -
            (tmp0 * m01 + tmp7 * m21 + tmp8 * m31);
        const t2 = (tmp2 * m01 + tmp7 * m11 + tmp10 * m31) -
            (tmp3 * m01 + tmp6 * m11 + tmp11 * m31);
        const t3 = (tmp5 * m01 + tmp8 * m11 + tmp11 * m21) -
            (tmp4 * m01 + tmp9 * m11 + tmp10 * m21);

        const d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);

        dst[0] = d * t0;
        dst[1] = d * t1;
        dst[2] = d * t2;
        dst[3] = d * t3;
        dst[4] = d * ((tmp1 * m10 + tmp2 * m20 + tmp5 * m30) -
            (tmp0 * m10 + tmp3 * m20 + tmp4 * m30));
        dst[5] = d * ((tmp0 * m00 + tmp7 * m20 + tmp8 * m30) -
            (tmp1 * m00 + tmp6 * m20 + tmp9 * m30));
        dst[6] = d * ((tmp3 * m00 + tmp6 * m10 + tmp11 * m30) -
            (tmp2 * m00 + tmp7 * m10 + tmp10 * m30));
        dst[7] = d * ((tmp4 * m00 + tmp9 * m10 + tmp10 * m20) -
            (tmp5 * m00 + tmp8 * m10 + tmp11 * m20));
        dst[8] = d * ((tmp12 * m13 + tmp15 * m23 + tmp16 * m33) -
            (tmp13 * m13 + tmp14 * m23 + tmp17 * m33));
        dst[9] = d * ((tmp13 * m03 + tmp18 * m23 + tmp21 * m33) -
            (tmp12 * m03 + tmp19 * m23 + tmp20 * m33));
        dst[10] = d * ((tmp14 * m03 + tmp19 * m13 + tmp22 * m33) -
            (tmp15 * m03 + tmp18 * m13 + tmp23 * m33));
        dst[11] = d * ((tmp17 * m03 + tmp20 * m13 + tmp23 * m23) -
            (tmp16 * m03 + tmp21 * m13 + tmp22 * m23));
        dst[12] = d * ((tmp14 * m22 + tmp17 * m32 + tmp13 * m12) -
            (tmp16 * m32 + tmp12 * m12 + tmp15 * m22));
        dst[13] = d * ((tmp20 * m32 + tmp12 * m02 + tmp19 * m22) -
            (tmp18 * m22 + tmp21 * m32 + tmp13 * m02));
        dst[14] = d * ((tmp18 * m12 + tmp23 * m32 + tmp15 * m02) -
            (tmp22 * m32 + tmp14 * m02 + tmp19 * m12));
        dst[15] = d * ((tmp22 * m22 + tmp16 * m02 + tmp21 * m12) -
            (tmp20 * m12 + tmp23 * m22 + tmp17 * m02));

        this._inverseDirty = false;
    }

    private _ensureTransform(): void {
        if (this._transformDirty) this._calculateTransform();
        if (this._inverseDirty) this._updateInverse();
    }

    /**
     * Scratch-space point -> texture UV in [0,1], with the shape effects
     * applied when any effect is active (Drawable.js getLocalPosition).
     * Writes into the instance's scratch buffer.
     */
    public getLocalPosition(vec: ArrayLike<number>): [number, number] {
        this._ensureTransform();
        const v0 = vec[0];
        const v1 = vec[1];
        const m = this._inverse;
        const d = (v0 * m[3]) + (v1 * m[7]) + m[15];

        const local = this._local;
        local[0] = 0.5 - (((v0 * m[0]) + (v1 * m[4]) + m[12]) / d);
        local[1] = (((v0 * m[1]) + (v1 * m[5]) + m[13]) / d) + 0.5;

        if (Math.abs(local[0]) < FLOATING_POINT_ERROR_ALLOWANCE) local[0] = 0;
        if (Math.abs(local[1]) < FLOATING_POINT_ERROR_ALLOWANCE) local[1] = 0;

        if (this._effects.enabledEffects !== 0 &&
            local[0] >= 0 && local[0] < 1 &&
            local[1] >= 0 && local[1] < 1) {
            const skinSize: readonly [number, number] =
                this._skin !== null ? this._skin.size : [0, 0];
            transformPoint(this._effects, skinSize, local[0], local[1], local);
        }
        return local;
    }

    /**
     * updateCPURenderAttributes: refresh transform + silhouette, then pick
     * nearest/linear touch sampling the way Skin.useNearest does.
     */
    public updateCPURenderAttributes(): void {
        this._ensureTransform();
        const skin = this._skin;
        if (skin === null) {
            this.isTouching = () => false;
            return;
        }
        skin.silhouetteFor(this._scale[0]);
        if (skin.isSvg) {
            // SVGSkin.useNearest: shape effects or off-axis rotation or a
            // scale far from 100% go linear, otherwise nearest.
            const shapeMask = EFFECT_MASK_FISHEYE | EFFECT_MASK_WHIRL |
                EFFECT_MASK_PIXELATE | EFFECT_MASK_MOSAIC;
            const shapeEffects = (this._effects.enabledEffects & shapeMask) !== 0;
            const axisAligned = this._direction % 90 === 0;
            const nearScale = Math.abs(this._scale[0]) > 99 && Math.abs(this._scale[0]) < 101 &&
                Math.abs(this._scale[1]) > 99 && Math.abs(this._scale[1]) < 101;
            this.isTouching = (!shapeEffects && axisAligned && nearScale)
                ? (vec) => this._isTouchingNearest(vec)
                : (vec) => this._isTouchingLinear(vec);
        } else {
            this.isTouching = (vec) => this._isTouchingNearest(vec);
        }
    }

    private _isTouchingNearest(vec: ArrayLike<number>): boolean {
        const skin = this._skin;
        if (skin === null) return false;
        const silhouette = skin.silhouetteFor(this._scale[0]);
        if (silhouette === null) return false;
        const local = this.getLocalPosition(vec);
        return silhouette.isTouchingNearest(local[0], local[1]);
    }

    private _isTouchingLinear(vec: ArrayLike<number>): boolean {
        const skin = this._skin;
        if (skin === null) return false;
        const silhouette = skin.silhouetteFor(this._scale[0]);
        if (silhouette === null) return false;
        const local = this.getLocalPosition(vec);
        return silhouette.isTouchingLinear(local[0], local[1]);
    }

    /**
     * Color at a scratch-space point, premultiplied color4b, with the
     * optional effect mask (Drawable.sampleColor4b). Out-of-bounds reads as
     * transparent black.
     */
    public sampleColor4b(vec: ArrayLike<number>, dst: Uint8ClampedArray, effectMask?: number): Uint8ClampedArray {
        const skin = this._skin;
        const silhouette = skin !== null ? skin.silhouetteFor(this._scale[0]) : null;
        const local = this.getLocalPosition(vec);

        if (silhouette === null ||
            local[0] < 0 || local[1] < 0 || local[0] > 1 || local[1] > 1) {
            dst[0] = 0;
            dst[1] = 0;
            dst[2] = 0;
            dst[3] = 0;
            return dst;
        }

        silhouette.colorAtNearest(local[0], local[1], dst);
        if (this._effects.enabledEffects === 0) return dst;
        return transformColor(this._effects, dst, effectMask);
    }

    /** Rough AABB: the unit square through the model matrix (getAABB). */
    public getAABB(result: CatnipRectangle = new CatnipRectangle()): CatnipRectangle {
        this._ensureTransform();
        result.initFromModelMatrix(this._model);
        return result;
    }

    /**
     * Convex hull of the opaque pixels in skin-unit space — the port of
     * RenderWebGL._getConvexHullPointsForDrawable (hull.js pass skipped).
     * Empty for invisible/missing skins, which sends callers to the AABB.
     */
    private _computeHull(): number[][] {
        const skin = this._skin;
        if (skin === null || !this.visible) return [];

        const silhouette = skin.silhouetteFor(this._scale[0]);
        if (silhouette === null || silhouette.isEmpty) return [];

        // updateEffect dirties the hull when `shapeChanges` — the four shape
        // effects: their mask bits *and* their uniform values feed the scan.
        const shapeKey = `${this._effects.enabledEffects &
            (EFFECT_MASK_FISHEYE | EFFECT_MASK_WHIRL | EFFECT_MASK_PIXELATE | EFFECT_MASK_MOSAIC)}:` +
            `${this._effects.u_fisheye},${this._effects.u_whirl},${this._effects.u_pixelate},${this._effects.u_mosaic}`;
        if (this._hull !== null &&
            this._hullShapeKey === shapeKey &&
            this._hullSilhouette === silhouette) {
            return this._hull;
        }

        const [width, height] = skin.size;
        if (width === 0 || height === 0) return [];

        const determinant = (a: number[], b: number[], c: number[]): number =>
            ((b[0] - a[0]) * (c[1] - a[1])) - ((b[1] - a[1]) * (c[0] - a[0]));

        const leftHull: number[][] = [];
        const rightHull: number[][] = [];
        let leftEndPointIndex = -1;
        let rightEndPointIndex = -1;

        const effectPos: number[] = [0, 0];
        let currentPoint: number[] = [0, 0];

        // *Not* scratch space — +y is bottom (texture rows top to bottom).
        for (let y = 0; y < height; y++) {
            const uvY = y / height;

            let x = 0;
            for (; x < width; x++) {
                transformPoint(this._effects, skin.size, x / width, uvY, effectPos);
                if (silhouette.isTouchingLinear(effectPos[0], effectPos[1])) {
                    currentPoint = [x, y];
                    break;
                }
            }
            if (x >= width) continue;

            while (leftEndPointIndex > 0) {
                if (determinant(leftHull[leftEndPointIndex], leftHull[leftEndPointIndex - 1], currentPoint) > 0) break;
                --leftEndPointIndex;
            }
            leftHull[++leftEndPointIndex] = currentPoint;

            for (x = width - 1; x >= 0; x--) {
                transformPoint(this._effects, skin.size, x / width, uvY, effectPos);
                if (silhouette.isTouchingLinear(effectPos[0], effectPos[1])) {
                    currentPoint = [x, y];
                    break;
                }
            }
            // The right side walks right-to-left, so the winding test flips.
            while (rightEndPointIndex > 0) {
                if (determinant(rightHull[rightEndPointIndex], rightHull[rightEndPointIndex - 1], currentPoint) < 0) break;
                --rightEndPointIndex;
            }
            rightHull[++rightEndPointIndex] = currentPoint;
        }

        const hullPoints = leftHull.slice(0, leftEndPointIndex + 1);
        for (let j = rightEndPointIndex; j >= 0; --j) hullPoints.push(rightHull[j]);

        this._hull = hullPoints;
        this._hullShapeKey = shapeKey;
        this._hullSilhouette = silhouette;
        return hullPoints;
    }

    /**
     * Tight bounds: the transformed convex hull when one exists, otherwise
     * the rough AABB — scratch's getFastBounds after RenderWebGL has ensured
     * the hull (invisible/skinless drawables fall through to the AABB there
     * too, because their hull is empty).
     */
    public getBounds(result: CatnipRectangle = new CatnipRectangle()): CatnipRectangle {
        const hull = this._computeHull();
        if (hull.length === 0) return this.getAABB(result);

        this._ensureTransform();
        const skin = this._skin!;
        const skinWidth = skin.size[0];
        const skinHeight = skin.size[1];
        const halfXPixel = 1 / skinWidth / 2;
        const halfYPixel = 1 / skinHeight / 2;
        const m = this._model;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const point of hull) {
            // Same mapping as Drawable._getTransformedHullPoints: the quad's
            // X axis is flipped (model * ortho(-1,1,...) with z = 0).
            const x = 0.5 - (point[0] / skinWidth) - halfXPixel;
            const y = (point[1] / skinHeight) - 0.5 + halfYPixel;
            const tx = (m[0] * x) + (m[4] * y) + m[12];
            const ty = (m[1] * x) + (m[5] * y) + m[13];
            if (tx < minX) minX = tx;
            if (tx > maxX) maxX = tx;
            if (ty < minY) minY = ty;
            if (ty > maxY) maxY = ty;
        }
        result.initFromBounds(minX, maxX, minY, maxY);
        return result;
    }
}
