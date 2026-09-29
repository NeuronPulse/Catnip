
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

/** One target's say/think bubble as it crosses the worker → page boundary. */
export type CatnipBubbleUpdate = {
    /** Target index in project.json order (0 = stage). */
    index: number;
    /** CATNIP_BUBBLE_* — 0 none, 1 say, 2 think. */
    type: number;
    /** Empty when the bubble was cleared. */
    text: string;
};

export interface ICatnipRenderer {

    penDrawLines(data: Float32Array, length: number): void;
    penEraseAll(): void;

    /**
     * The visual state of every target of the project, in sprite order, packed
     * DRAW_STATE_STRIDE floats per target (see DRAW_STATE).
     */
    drawState(data: Float32Array): void;

    /**
     * The layer rank of every target, in sprite order (index 0 = stage,
     * which is never reordered). Sent only when a layer op changed a rank;
     * the receiver re-sorts the drawables by rank.
     */
    layer(data: Int32Array): void;

    /**
     * Bubble updates for targets whose bubble_gen changed: text and kind per
     * target (0 = no bubble). Sent only on change; the receiver swaps DOM
     * overlay nodes.
     */
    bubble(data: CatnipBubbleUpdate[]): void;

    /**
     * A clone appeared: draw-state, layer and bubble arrays are indexed by
     * slot (the originals keep 0..n-1 forever, clones fill later slots), and
     * a new slot needs its drawable before the next drawState can mention
     * it. spriteIndex is the owning sprite — clones share their sprite's
     * costumes, so the receiver maps the slot to the sprite's skins.
     */
    cloneAdd(slot: number, spriteIndex: number): void;

    /** A clone was deleted (or every clone was disposed): drop its drawable. */
    cloneRemove(slot: number): void;

    frame(): void;

}
