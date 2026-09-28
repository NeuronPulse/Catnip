import { CatnipWasmStructCostume } from "../wasm-interop/CatnipWasmStructCostume";
import { WasmStructWrapper } from "../wasm-interop/wasm-types";
import { CatnipSprite } from "./CatnipSprite";

export interface CatnipCostumeDesc {
    name: string;
    /** The costume's asset file inside the project zip, e.g. "0a2b3c.svg". */
    md5ext: string;
    /** The asset's data format: "svg" for vectors, "png" for bitmaps. */
    dataFormat: string;
    /** The x-coordinate of the costume's center, in costume pixels. */
    rotationCenterX: number;
    /** The y-coordinate of the costume's center, in costume pixels. */
    rotationCenterY: number;
    /** Costumes are bitmaps at 2× the stage resolution; 1 for vectors. */
    bitmapResolution: number;
}

export class CatnipCostume {
    public readonly sprite: CatnipSprite;
    public get runtime() { return this.sprite.runtime; }
    public readonly index: number;
    public readonly name: string;
    public readonly md5ext: string;
    public readonly dataFormat: string;
    public readonly rotationCenterX: number;
    public readonly rotationCenterY: number;
    public readonly bitmapResolution: number;

    /** The wasm struct this costume was written to, for the late AABB fill. */
    private _struct?: WasmStructWrapper<typeof CatnipWasmStructCostume>;

    public constructor(sprite: CatnipSprite, index: number, desc: CatnipCostumeDesc) {
        this.sprite = sprite;
        this.index = index;
        this.name = desc.name;
        this.md5ext = desc.md5ext;
        this.dataFormat = desc.dataFormat;
        this.rotationCenterX = desc.rotationCenterX;
        this.rotationCenterY = desc.rotationCenterY;
        this.bitmapResolution = desc.bitmapResolution;
    }

    /** @internal */
    _write(struct: WasmStructWrapper<typeof CatnipWasmStructCostume>) {
        this._struct = struct;
        struct.setMember("name", this.runtime.createCanonHString(this.name));
    }

    /**
     * Measures the asset and fills the costume's AABB in wasm (see
     * module/catnip_costume.h for the coordinate space). The size is read
     * without a DOM: PNGs carry it in their IHDR, SVGs in their root tag, so
     * headless runs measure exactly like the playground does.
     */
    public measureAndWriteBounds(data: Uint8Array): void {
        const size = this._measureNaturalSize(data);
        const resolution = this.bitmapResolution || 1;

        let left = 0, right = 0, top = 0, bottom = 0;

        if (size !== null) {
            const centerX = this.rotationCenterX / resolution;
            const centerY = this.rotationCenterY / resolution;
            const width = size.width / resolution;
            const height = size.height / resolution;

            left = -centerX;
            right = width - centerX;
            top = centerY;
            bottom = centerY - height;
        }

        const struct = this._struct;
        if (struct === undefined) return; // Costume was never written to wasm.

        struct.setMember("aabb_left", left);
        struct.setMember("aabb_right", right);
        struct.setMember("aabb_top", top);
        struct.setMember("aabb_bottom", bottom);
        struct.setMember("natural_width", size !== null ? size.width / resolution : 0);
        struct.setMember("natural_height", size !== null ? size.height / resolution : 0);
    }

    /** The asset's size in costume pixels, or null when it cannot be read. */
    private _measureNaturalSize(data: Uint8Array): { width: number, height: number } | null {
        if (this.dataFormat === "png")
            return this._measurePng(data);

        if (this.dataFormat === "svg")
            return this._measureSvg(data);

        return null;
    }

    private _measurePng(data: Uint8Array): { width: number, height: number } | null {
        // signature (8) | IHDR length+tag (8) | width (4, BE) | height (4, BE)
        if (data.length < 24) return null;
        if (data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4e || data[3] !== 0x47) return null;
        if (data[12] !== 0x49 || data[13] !== 0x48 || data[14] !== 0x44 || data[15] !== 0x52) return null;

        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const width = view.getUint32(16);
        const height = view.getUint32(20);

        if (width === 0 || height === 0) return null;
        return { width, height };
    }

    private _measureSvg(data: Uint8Array): { width: number, height: number } | null {
        const text = new TextDecoder().decode(data);
        const match = /<svg\b[^>]*>/i.exec(text);
        if (match === null) return null;

        const root = match[0];
        const attr = (name: string): number | null => {
            const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(root);
            if (m === null) return null;
            // Widths like "216" or "216px" measure; "100%" does not (fall back).
            if (!/^\d+(\.\d+)?(px)?$/.test(m[1].trim())) return null;
            return parseFloat(m[1]);
        };

        const width = attr("width");
        const height = attr("height");
        if (width !== null && height !== null && width > 0 && height > 0)
            return { width, height };

        const viewBox = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(root);
        if (viewBox !== null) {
            const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
            if (parts.length === 4 && parts[2] > 0 && parts[3] > 0 && !parts.some(isNaN))
                return { width: parts[2], height: parts[3] };
        }

        return null;
    }
}
