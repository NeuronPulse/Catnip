/**
 * Texture decoding for the touch queries.
 *
 * - `decodePng`: a small pure-JS PNG -> RGBA8 decoder (pako for the zlib
 *   streams) so node/tap can run the same query code as the worker. Covers
 *   color types 0/2/3/4/6 at bit depths 1/2/4/8/16 without interlacing —
 *   everything Scratch itself writes. Anything else throws and the caller
 *   degrades to "no silhouette" with a warning.
 * - `upscaleNearest2x`: scratch-vm normalizes bitmap costumes to resolution
 *   2 at load; for resolution-1 costumes `v2BitmapAdapter.resize` does a
 *   two-step nearest-neighbor upscale (imageSmoothingEnabled = false) — same
 *   result here.
 * - SVG: scratch-render rasterizes through an `<img>` + canvas; the worker
 *   equivalent is `createImageBitmap` + `OffscreenCanvas`. In node neither
 *   exists, so `svgRasterize` returns null and those costumes simply have no
 *   silhouette (the bundled fixtures use PNG costumes for this reason).
 */
import pako from "pako";
import { CatnipSilhouette } from "./CatnipSilhouette";

export interface CatnipRaster {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}

function readU32(bytes: Uint8Array, offset: number): number {
    return (((bytes[offset] << 24) | (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function paeth(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

/** Decode a PNG file into straight-alpha RGBA8. Throws on anything exotic. */
export function decodePng(bytes: Uint8Array): CatnipRaster {
    for (let i = 0; i < 8; i++) {
        if (bytes[i] !== PNG_SIGNATURE[i])
            throw new Error("Not a PNG file.");
    }

    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    let palette: Uint8Array | null = null;
    let paletteAlpha: Uint8Array | null = null;
    let grayTransparency = -1;
    let rgbTransparency: [number, number, number] | null = null;
    const idatParts: Uint8Array[] = [];

    let offset = 8;
    let sawIhdr = false;
    while (offset + 8 <= bytes.length) {
        const length = readU32(bytes, offset);
        const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
        const dataStart = offset + 8;
        if (dataStart + length > bytes.length) throw new Error("Truncated PNG chunk.");

        if (type === "IHDR") {
            width = readU32(bytes, dataStart);
            height = readU32(bytes, dataStart + 4);
            bitDepth = bytes[dataStart + 8];
            colorType = bytes[dataStart + 9];
            interlace = bytes[dataStart + 12];
            sawIhdr = true;
        } else if (type === "PLTE") {
            palette = bytes.subarray(dataStart, dataStart + length);
        } else if (type === "tRNS") {
            // For color types 0/2 the transparency values sit in the low-order
            // bits of their 2-byte fields when the bit depth is < 16 (unlike
            // image data, which is left-justified) — stored the way libpng
            // writes them, compared directly against the raw sample below.
            if (colorType === 3) {
                paletteAlpha = bytes.subarray(dataStart, dataStart + length);
            } else if (colorType === 0 && length >= 2) {
                grayTransparency = (bytes[dataStart] << 8) | bytes[dataStart + 1];
            } else if (colorType === 2 && length >= 6) {
                rgbTransparency = [
                    (bytes[dataStart] << 8) | bytes[dataStart + 1],
                    (bytes[dataStart + 2] << 8) | bytes[dataStart + 3],
                    (bytes[dataStart + 4] << 8) | bytes[dataStart + 5]
                ];
            }
        } else if (type === "IDAT") {
            idatParts.push(bytes.subarray(dataStart, dataStart + length));
        } else if (type === "IEND") {
            break;
        }

        offset = dataStart + length + 4; // data + CRC
    }

    if (!sawIhdr) throw new Error("PNG has no IHDR.");
    if (width <= 0 || height <= 0) throw new Error("PNG has no pixels.");
    if (interlace !== 0) throw new Error("Interlaced PNG not supported.");
    if (idatParts.length === 0) throw new Error("PNG has no IDAT.");

    let compressedLength = 0;
    for (const part of idatParts) compressedLength += part.length;
    const compressed = new Uint8Array(compressedLength);
    let compressedOffset = 0;
    for (const part of idatParts) {
        compressed.set(part, compressedOffset);
        compressedOffset += part.length;
    }
    const raw = pako.inflate(compressed);

    const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 4;
    if (![1, 2, 4, 8, 16].includes(bitDepth)) throw new Error(`Unsupported PNG bit depth ${bitDepth}.`);
    if (colorType === 3 && palette === null) throw new Error("Palette PNG without PLTE.");
    if (![0, 2, 3, 4, 6].includes(colorType)) throw new Error(`Unsupported PNG color type ${colorType}.`);

    const bitsPerPixel = channels * bitDepth;
    const bytesPerPixel = Math.max(1, bitsPerPixel >> 3);
    const bytesPerLine = Math.ceil((bitsPerPixel * width) / 8);
    if (raw.length < (bytesPerLine + 1) * height) throw new Error("PNG data too short.");

    // Undo the per-row filters in place (rows go top to bottom, so the row
    // above is already unfiltered when we read it back).
    const rowStride = bytesPerLine + 1;
    for (let y = 0; y < height; y++) {
        const rowStart = y * rowStride;
        const filter = raw[rowStart];
        const line = raw.subarray(rowStart + 1, rowStart + 1 + bytesPerLine);
        const prev = y > 0 ? raw.subarray(rowStart + 1 - rowStride, rowStart + 1 - rowStride + bytesPerLine) : null;
        for (let x = 0; x < bytesPerLine; x++) {
            const a = x >= bytesPerPixel ? line[x - bytesPerPixel] : 0;
            const b = prev !== null ? prev[x] : 0;
            const c = prev !== null && x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
            let value = line[x];
            switch (filter) {
            case 0: break;
            case 1: value = (value + a) & 0xFF; break;
            case 2: value = (value + b) & 0xFF; break;
            case 3: value = (value + ((a + b) >> 1)) & 0xFF; break;
            case 4: value = (value + paeth(a, b, c)) & 0xFF; break;
            default: throw new Error(`Unsupported PNG filter ${filter}.`);
            }
            line[x] = value;
        }
    }

    // Expand to RGBA8.
    const out = new Uint8ClampedArray(width * height * 4);
    const maxValue = bitDepth === 16 ? 65535 : (1 << bitDepth) - 1;

    const sampleAt = (line: Uint8Array, pixelIndex: number, channel: number): number => {
        if (bitDepth === 8) return line[pixelIndex * channels + channel];
        if (bitDepth === 16) {
            const o = (pixelIndex * channels + channel) * 2;
            return (line[o] << 8) | line[o + 1];
        }
        const bitIndex = (pixelIndex * channels + channel) * bitDepth;
        const byte = line[bitIndex >> 3];
        const shift = 8 - bitDepth - (bitIndex & 7);
        return (byte >> shift) & maxValue;
    };

    for (let y = 0; y < height; y++) {
        const line = raw.subarray(1 + y * (bytesPerLine + 1), 1 + y * (bytesPerLine + 1) + bytesPerLine);
        for (let x = 0; x < width; x++) {
            const outOffset = (y * width + x) * 4;
            if (colorType === 0) {
                const gray = sampleAt(line, x, 0);
                const scale = 255 / maxValue;
                out[outOffset] = gray * scale;
                out[outOffset + 1] = gray * scale;
                out[outOffset + 2] = gray * scale;
                out[outOffset + 3] = gray === grayTransparency ? 0 : 255;
            } else if (colorType === 2) {
                const r = sampleAt(line, x, 0);
                const g = sampleAt(line, x, 1);
                const b = sampleAt(line, x, 2);
                const scale = 255 / maxValue;
                out[outOffset] = r * scale;
                out[outOffset + 1] = g * scale;
                out[outOffset + 2] = b * scale;
                const transparent = rgbTransparency !== null &&
                    r === rgbTransparency[0] && g === rgbTransparency[1] && b === rgbTransparency[2];
                out[outOffset + 3] = transparent ? 0 : 255;
            } else if (colorType === 3) {
                const index = sampleAt(line, x, 0);
                const paletteOffset = index * 3;
                if (paletteOffset + 2 >= palette!.length) throw new Error("PNG palette index out of range.");
                out[outOffset] = palette![paletteOffset];
                out[outOffset + 1] = palette![paletteOffset + 1];
                out[outOffset + 2] = palette![paletteOffset + 2];
                out[outOffset + 3] = paletteAlpha !== null && index < paletteAlpha.length ? paletteAlpha[index] : 255;
            } else if (colorType === 4) {
                const gray = sampleAt(line, x, 0);
                const alpha = sampleAt(line, x, 1);
                const scale = 255 / maxValue;
                out[outOffset] = gray * scale;
                out[outOffset + 1] = gray * scale;
                out[outOffset + 2] = gray * scale;
                out[outOffset + 3] = alpha * scale;
            } else {
                const scale = 255 / maxValue;
                out[outOffset] = sampleAt(line, x, 0) * scale;
                out[outOffset + 1] = sampleAt(line, x, 1) * scale;
                out[outOffset + 2] = sampleAt(line, x, 2) * scale;
                out[outOffset + 3] = sampleAt(line, x, 3) * scale;
            }
        }
    }

    return { width, height, data: out };
}

/** Nearest-neighbor x2 upscale — scratch's v2BitmapAdapter.resize. */
export function upscaleNearest2x(raster: CatnipRaster): CatnipRaster {
    const width = raster.width * 2;
    const height = raster.height * 2;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        const srcY = y >> 1;
        for (let x = 0; x < width; x++) {
            const src = ((srcY * raster.width) + (x >> 1)) * 4;
            const dst = ((y * width) + x) * 4;
            data[dst] = raster.data[src];
            data[dst + 1] = raster.data[src + 1];
            data[dst + 2] = raster.data[src + 2];
            data[dst + 3] = raster.data[src + 3];
        }
    }
    return { width, height, data };
}

export function rasterToSilhouette(raster: CatnipRaster): CatnipSilhouette {
    return new CatnipSilhouette(raster.width, raster.height, raster.data);
}

function parseLength(value: string | null): number {
    if (value === null) return 0;
    const match = /^\s*(-?[\d.]+)(?:px)?\s*$/.exec(value);
    if (match === null) return 0;
    const n = parseFloat(match[1]);
    return Number.isFinite(n) ? n : 0;
}

/**
 * SVGSkin reads its size from `svgTag.viewBox.baseVal` (falling back to the
 * width/height attributes when there is no viewBox) and offsets the rotation
 * center by the viewBox origin. Node has no SVG DOM, so the viewBox is
 * parsed as text; when it is missing we fall back to width/height.
 */
export function parseSvgSize(svgText: string): { x: number, y: number, width: number, height: number } {
    const viewBox = /viewBox\s*=\s*["']([^"']*)["']/i.exec(svgText);
    if (viewBox !== null) {
        const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts.every(Number.isFinite)) {
            return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
        }
    }
    const width = parseLength(/<svg[^>]*\swidth\s*=\s*["']([^"']*)["']/i.exec(svgText)?.[1] ?? null);
    const height = parseLength(/<svg[^>]*\sheight\s*=\s*["']([^"']*)["']/i.exec(svgText)?.[1] ?? null);
    return { x: 0, y: 0, width, height };
}

/**
 * Rasterize an SVG at `scale` the way SVGSkin.createMIP does: a canvas of
 * (size * scale) with the image drawn under the same transform. Returns null
 * outside the browser (no OffscreenCanvas/createImageBitmap) or when the
 * image cannot be rasterized.
 *
 * Deviation from scratch-render: embedded webfonts are not injected (that
 * needs scratch-svg-renderer's DOM pipeline), so text in costumes falls back
 * to the worker's available fonts.
 */
export async function svgRasterize(svgText: string, scale: number): Promise<CatnipRaster | null> {
    if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined")
        return null;

    try {
        const image = await createImageBitmap(
            new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
        if (image.width <= 0 || image.height <= 0) return null;

        const width = Math.floor(image.width * scale);
        const height = Math.floor(image.height * scale);
        if (width <= 0 || height <= 0) return null;

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        if (ctx === null) return null;
        ctx.clearRect(0, 0, width, height);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, width, height);
        image.close();
        return { width, height, data: imageData.data };
    } catch {
        return null;
    }
}
