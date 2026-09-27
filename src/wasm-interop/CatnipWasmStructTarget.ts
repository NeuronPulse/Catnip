import { CatnipWasmStructList } from "./CatnipWasmStructList";
import { CatnipWasmPtrSprite } from "./CatnipWasmStructSprite";
import { CatnipWasmUnionValue } from "./CatnipWasmStructValue";
import { WasmInt32, WasmPtr, WasmStruct, WasmUInt32, WasmPtrVoid, WasmArray, WasmBool32, WasmFloat32, WasmFloat64 } from "./wasm-types";

/** Mirrors CATNIP_TARGET_FLAG_* in module/catnip_target.h. */
export const CATNIP_TARGET_FLAG_IS_CLONE = 1 << 0;
export const CATNIP_TARGET_FLAG_IS_STAGE = 1 << 1;
export const CATNIP_TARGET_FLAG_IS_VISIBLE = 1 << 2;

/** Mirrors CATNIP_ROTATION_STYLE_* in module/catnip_target.h. */
export const CATNIP_ROTATION_STYLE_ALL_AROUND = 0;
export const CATNIP_ROTATION_STYLE_LEFT_RIGHT = 1;
export const CATNIP_ROTATION_STYLE_NONE = 2;

export const CatnipWasmStructTarget = new WasmStruct("catnip_target", {
    runtime: WasmPtrVoid,
    sprite: CatnipWasmPtrSprite,
    flags: WasmUInt32,

    next_global: WasmPtrVoid,
    prev_global: WasmPtrVoid,

    next_sprite: WasmPtrVoid,
    prev_sprite: WasmPtrVoid,

    variable_table: new WasmPtr(new WasmArray(CatnipWasmUnionValue, null)),
    list_table: new WasmPtr(new WasmArray(CatnipWasmStructList, null)),

    position_x: WasmFloat64,
    position_y: WasmFloat64,
    direction: WasmFloat64,
    size: WasmFloat64,
    costume: WasmUInt32,

    pen_down: WasmBool32,
    pen_thickness: WasmFloat32,

    pen_argb_valid: WasmBool32,
    pen_argb: WasmUInt32,
    
    pen_thsv_valid: WasmBool32,
    pen_transparency: WasmFloat64,
    pen_hue: WasmFloat64,
    pen_saturation: WasmFloat64,
    pen_value: WasmFloat64,

    effect_color: WasmFloat64,
    effect_fisheye: WasmFloat64,
    effect_whirl: WasmFloat64,
    effect_pixelate: WasmFloat64,
    effect_mosaic: WasmFloat64,
    effect_brightness: WasmFloat64,
    effect_ghost: WasmFloat64,

    volume: WasmInt32,
    tempo: WasmInt32,

    rotation_style: WasmUInt32,

    glide_start_x: WasmFloat64,
    glide_start_y: WasmFloat64,
    glide_end_x: WasmFloat64,
    glide_end_y: WasmFloat64,
    glide_t0: WasmFloat64,
    glide_duration: WasmFloat64,
});

export const CatnipWasmPtrTarget = new WasmPtr(CatnipWasmStructTarget);