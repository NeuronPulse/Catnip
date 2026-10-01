/**
 * Port of scratch-render's Silhouette (src/Silhouette.js): the alpha/color
 * map a Skin derives from its texture, sampled with nearest neighbor or the
 * 4-corner linear test.
 *
 * Only the non-premultiplied path is ported (`update(data, false)` — PNG and
 * canvas ImageData are straight-alpha sources; the premultiplied variant in
 * the renderer only serves readPixels output which we never feed in).
 */

export class CatnipSilhouette {
    public width = 0;
    public height = 0;
    /** RGBA, straight alpha, `width * height * 4` bytes. */
    public data: Uint8ClampedArray | null = null;

    public constructor(width: number = 0, height: number = 0, data: Uint8ClampedArray | null = null) {
        this.width = width;
        this.height = height;
        this.data = data;
    }

    public get isEmpty(): boolean {
        return this.data === null || this.width === 0 || this.height === 0;
    }

    /** Alpha at integer pixel, 0 outside — Silhouette's `getPoint`. */
    public getPoint(x: number, y: number): number {
        const data = this.data;
        if (data === null) return 0;
        if (x >= this.width || y >= this.height || x < 0 || y < 0) return 0;
        return data[(((y * this.width) + x) * 4) + 3];
    }

    /**
     * Straight -> premultiplied color4b at an integer pixel, clamped to the
     * edge (matching GL_CLAMP_TO_EDGE) — Silhouette's `getColor4b`.
     */
    public getColor4b(x: number, y: number, dst: Uint8ClampedArray): Uint8ClampedArray {
        const data = this.data;
        if (data === null) {
            dst.fill(0);
            return dst;
        }
        x = Math.max(0, Math.min(x, this.width - 1));
        y = Math.max(0, Math.min(y, this.height - 1));
        if (x >= this.width || y >= this.height || x < 0 || y < 0) {
            dst.fill(0);
            return dst;
        }
        const offset = ((y * this.width) + x) * 4;
        const alpha = data[offset + 3] / 255;
        dst[0] = data[offset] * alpha;
        dst[1] = data[offset + 1] * alpha;
        dst[2] = data[offset + 2] * alpha;
        dst[3] = data[offset + 3];
        return dst;
    }

    /** Nearest-neighbor color at a UV in [0,1]. */
    public colorAtNearest(u: number, v: number, dst: Uint8ClampedArray): Uint8ClampedArray {
        return this.getColor4b(
            Math.floor(u * (this.width - 1)),
            Math.floor(v * (this.height - 1)),
            dst
        );
    }

    public isTouchingNearest(u: number, v: number): boolean {
        if (this.data === null) return false;
        return this.getPoint(
            Math.floor(u * (this.width - 1)),
            Math.floor(v * (this.height - 1))
        ) > 0;
    }

    /** True when any of the 4 pixels under the linear tap has alpha. */
    public isTouchingLinear(u: number, v: number): boolean {
        if (this.data === null) return false;
        const x = Math.floor(u * (this.width - 1));
        const y = Math.floor(v * (this.height - 1));
        return this.getPoint(x, y) > 0 ||
            this.getPoint(x + 1, y) > 0 ||
            this.getPoint(x, y + 1) > 0 ||
            this.getPoint(x + 1, y + 1) > 0;
    }
}
