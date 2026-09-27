
export const PEN_LINE_BUFFER_SIZE = 16384;
export const PEN_ATTRIBUTE_STRIDE = 10;
export const PEN_ATTRIBUTE_STRIDE_BYTES = PEN_ATTRIBUTE_STRIDE * 4;

/**
 * Float32 fields per target in a draw state, in this order. The state covers
 * everything a drawable needs and is sent with every rendered frame; the
 * fields mirror struct catnip_target (module/catnip_target.h).
 */
export const DRAW_STATE_STRIDE = 14;
export const DRAW_STATE = {
    x: 0,
    y: 1,
    direction: 2,
    size: 3,
    costume: 4,
    visible: 5,
    effect_color: 6,
    effect_fisheye: 7,
    effect_whirl: 8,
    effect_pixelate: 9,
    effect_mosaic: 10,
    effect_brightness: 11,
    effect_ghost: 12,
    /** catnip rotation style: 0 = all around, 1 = left-right, 2 = don't rotate. */
    rotation_style: 13,
} as const;

export interface ICatnipRenderer {

    penDrawLines(data: Float32Array, length: number): void;
    penEraseAll(): void;

    /**
     * The visual state of every target of the project, in sprite order, packed
     * DRAW_STATE_STRIDE floats per target (see DRAW_STATE).
     */
    drawState(data: Float32Array): void;

    frame(): void;

}
