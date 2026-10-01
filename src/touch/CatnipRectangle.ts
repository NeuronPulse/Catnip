/**
 * Port of scratch-render's Rectangle (src/Rectangle.js).
 *
 * Scratch-space rectangles: +y is up, `top >= bottom`, iteration is
 * bottom <= top. Kept field-for-field so bounds math matches the renderer
 * pixel for pixel (fence clamps, snap-to-int, union/intersect all rely on
 * the exact comparison directions below).
 */
export class CatnipRectangle {
    public left = -Infinity;
    public right = Infinity;
    public bottom = -Infinity;
    public top = Infinity;

    public initFromBounds(left: number, right: number, bottom: number, top: number): void {
        this.left = left;
        this.right = right;
        this.bottom = bottom;
        this.top = top;
    }

    /** Minimum AABB around a set of [x, y] points. */
    public initFromPointsAABB(points: readonly (readonly number[])[]): void {
        this.left = Infinity;
        this.right = -Infinity;
        this.top = -Infinity;
        this.bottom = Infinity;

        for (let i = 0; i < points.length; i++) {
            const x = points[i][0];
            const y = points[i][1];
            if (x < this.left) this.left = x;
            if (x > this.right) this.right = x;
            if (y > this.top) this.top = y;
            if (y < this.bottom) this.bottom = y;
        }
    }

    /**
     * The unit square centered on the origin transformed by a model matrix —
     * scratch-render's `initFromModelMatrix`. The matrix is column-major
     * 4x4; only the 2x2 top-left and the translation are meaningful here
     * (the drawable matrices are pure 2D affine).
     */
    public initFromModelMatrix(m: ArrayLike<number>): void {
        const m30 = m[(3 * 4) + 0];
        const m31 = m[(3 * 4) + 1];

        const x = Math.abs(0.5 * m[(0 * 4) + 0]) + Math.abs(0.5 * m[(1 * 4) + 0]);
        const y = Math.abs(0.5 * m[(0 * 4) + 1]) + Math.abs(0.5 * m[(1 * 4) + 1]);

        this.left = -x + m30;
        this.right = x + m30;
        this.top = y + m31;
        this.bottom = -y + m31;
    }

    public intersects(other: CatnipRectangle): boolean {
        return (
            this.left <= other.right &&
            other.left <= this.right &&
            this.top >= other.bottom &&
            other.top >= this.bottom
        );
    }

    public clamp(left: number, right: number, bottom: number, top: number): void {
        this.left = Math.max(this.left, left);
        this.right = Math.min(this.right, right);
        this.bottom = Math.max(this.bottom, bottom);
        this.top = Math.min(this.top, top);

        this.left = Math.min(this.left, right);
        this.right = Math.max(this.right, left);
        this.bottom = Math.min(this.bottom, top);
        this.top = Math.max(this.top, bottom);
    }

    public snapToInt(): void {
        this.left = Math.floor(this.left);
        this.right = Math.ceil(this.right);
        this.bottom = Math.floor(this.bottom);
        this.top = Math.ceil(this.top);
    }

    public static intersect(a: CatnipRectangle, b: CatnipRectangle, result: CatnipRectangle = new CatnipRectangle()): CatnipRectangle {
        result.left = Math.max(a.left, b.left);
        result.right = Math.min(a.right, b.right);
        result.top = Math.min(a.top, b.top);
        result.bottom = Math.max(a.bottom, b.bottom);
        return result;
    }

    public static union(a: CatnipRectangle, b: CatnipRectangle, result: CatnipRectangle = new CatnipRectangle()): CatnipRectangle {
        result.left = Math.min(a.left, b.left);
        result.right = Math.max(a.right, b.right);
        result.top = Math.max(a.top, b.top);
        result.bottom = Math.min(a.bottom, b.bottom);
        return result;
    }

    public get width(): number {
        return Math.abs(this.left - this.right);
    }

    public get height(): number {
        return Math.abs(this.top - this.bottom);
    }
}
