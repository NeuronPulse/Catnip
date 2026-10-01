/**
 * Color helpers for the touch queries.
 *
 * - `rgbToHsv` / `hsvToRgb`: ports of scratch-render
 *   `src/util/color-conversions.js`.
 * - `toRgbColorList`: port of `Cast.toRgbColorObject` + `Color.hexToRgb` /
 *   `Color.decimalToRgb` from scratch-vm (`src/util/cast.js`,
 *   `src/util/color.js`) — the exact rule the sensing op uses to turn its
 *   argument into [r, g, b].
 * - `colorMatches` / `maskMatches`: ports of the two scratch-2 derived
 *   tolerances at the top of scratch-render's `RenderWebGL.js`.
 */

/** RGB -> HSV, r/g/b in [0, 255], returns h/s/v in [0, 1]. */
export function rgbToHsv(rgb: ArrayLike<number>, dst: number[]): number[] {
    let K = 0.0;

    let r = rgb[0] / 255;
    let g = rgb[1] / 255;
    let b = rgb[2] / 255;
    let tmp = 0;

    if (g < b) {
        tmp = g;
        g = b;
        b = tmp;
        K = -1;
    }

    if (r < g) {
        tmp = r;
        r = g;
        g = tmp;
        K = (-2 / 6) - K;
    }

    const chroma = r - Math.min(g, b);
    const h = Math.abs(K + ((g - b) / ((6 * chroma) + Number.EPSILON)));
    const s = chroma / (r + Number.EPSILON);
    const v = r;

    dst[0] = h;
    dst[1] = s;
    dst[2] = v;
    return dst;
}

/** HSV -> RGB, h/s/v in [0, 1], writes r/g/b in [0, 255] into dst. */
export function hsvToRgb(hsv: ArrayLike<number>, dst: number[] | Uint8ClampedArray): number[] | Uint8ClampedArray {
    let h = hsv[0];
    const s = hsv[1];
    const v = hsv[2];

    if (s === 0) {
        dst[0] = dst[1] = dst[2] = (v * 255) + 0.5;
        return dst;
    }

    h %= 1;
    const i = (h * 6) | 0;
    const f = (h * 6) - i;
    const p = v * (1 - s);
    const q = v * (1 - (s * f));
    const t = v * (1 - (s * (1 - f)));

    let r = 0;
    let g = 0;
    let b = 0;

    switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
    }

    dst[0] = (r * 255) + 0.5;
    dst[1] = (g * 255) + 0.5;
    dst[2] = (b * 255) + 0.5;
    return dst;
}

/** Cast.toNumber: NaN becomes 0 (scratch's "NaN as 0" rule). */
function toNumber(value: string | number): number {
    if (typeof value === "number") {
        return Number.isNaN(value) ? 0 : value;
    }
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
}

/** Color.hexToRgb — returns null when the string is not a hex color. */
function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const expanded = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(expanded);
    if (result === null) return null;
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    };
}

/** Color.decimalToRgb — 0xAARRGGBB; alpha 0 means opaque for this cast. */
function decimalToRgb(decimal: number): { r: number, g: number, b: number, a: number } {
    const a = (decimal >> 24) & 0xFF;
    const r = (decimal >> 16) & 0xFF;
    const g = (decimal >> 8) & 0xFF;
    const b = decimal & 0xFF;
    return { r: r, g: g, b: b, a: a > 0 ? a : 255 };
}

/**
 * Cast.toRgbColorList: "#..." goes through hexToRgb (a non-hex string casts
 * to black), everything else through decimalToRgb(toNumber(v)) — so a plain
 * decimal, "0x..." or a garbage string lands where scratch lands.
 */
export function toRgbColorList(value: string | number): [number, number, number] {
    if (typeof value === "string" && value.substring(0, 1) === "#") {
        const color = hexToRgb(value);
        if (color === null) return [0, 0, 0];
        return [color.r, color.g, color.b];
    }
    const color = decimalToRgb(toNumber(value));
    return [color.r, color.g, color.b];
}

/** Scratch-2 tolerance: 5 top bits of R/G, 4 of B. `offset` indexes into b. */
export function colorMatches(a: ArrayLike<number>, b: ArrayLike<number>, offset: number): boolean {
    return (
        (a[0] & 0b11111000) === (b[offset + 0] & 0b11111000) &&
        (a[1] & 0b11111000) === (b[offset + 1] & 0b11111000) &&
        (a[2] & 0b11110000) === (b[offset + 2] & 0b11110000)
    );
}

/** Scratch-2 tolerance: 6 top bits per channel, and alpha must be nonzero. */
export function maskMatches(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
    return (
        a[3] > 0 &&
        (a[0] & 0b11111100) === (b[0] & 0b11111100) &&
        (a[1] & 0b11111100) === (b[1] & 0b11111100) &&
        (a[2] & 0b11111100) === (b[2] & 0b11111100)
    );
}
