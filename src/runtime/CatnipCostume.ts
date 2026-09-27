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
        struct.setMember("name", this.runtime.createCanonHString(this.name));
    }
}