/**
 * Port of scratch-render's EffectTransform (src/EffectTransform.js) and the
 * EFFECT_INFO table from src/ShaderManager.js — the CPU emulation of the
 * color/brightness/ghost fragment ops and the mosaic/pixelate/whirl/fisheye
 * texture-coordinate ops, so `touching color` and shape bounds agree with
 * what the shaders draw.
 */
import { hsvToRgb, rgbToHsv } from "./CatnipColor";

export const EFFECT_MASK_COLOR = 1 << 0;
export const EFFECT_MASK_FISHEYE = 1 << 1;
export const EFFECT_MASK_WHIRL = 1 << 2;
export const EFFECT_MASK_PIXELATE = 1 << 3;
export const EFFECT_MASK_MOSAIC = 1 << 4;
export const EFFECT_MASK_BRIGHTNESS = 1 << 5;
export const EFFECT_MASK_GHOST = 1 << 6;

const CENTER_X = 0.5;
const CENTER_Y = 0.5;

export interface CatnipEffectState {
    enabledEffects: number;
    u_color: number;
    u_fisheye: number;
    u_whirl: number;
    u_pixelate: number;
    u_mosaic: number;
    u_brightness: number;
    u_ghost: number;
}

/** Raw effect values (scratch units) -> enabled mask + shader uniforms. */
export function effectsFromRaw(raw: {
    color: number,
    fisheye: number,
    whirl: number,
    pixelate: number,
    mosaic: number,
    brightness: number,
    ghost: number
}): CatnipEffectState {
    let enabledEffects = 0;
    if (raw.color) enabledEffects |= EFFECT_MASK_COLOR;
    if (raw.fisheye) enabledEffects |= EFFECT_MASK_FISHEYE;
    if (raw.whirl) enabledEffects |= EFFECT_MASK_WHIRL;
    if (raw.pixelate) enabledEffects |= EFFECT_MASK_PIXELATE;
    if (raw.mosaic) enabledEffects |= EFFECT_MASK_MOSAIC;
    if (raw.brightness) enabledEffects |= EFFECT_MASK_BRIGHTNESS;
    if (raw.ghost) enabledEffects |= EFFECT_MASK_GHOST;

    // The converters from ShaderManager.EFFECT_INFO, verbatim.
    const mosaic = Math.max(1, Math.min(Math.round((Math.abs(raw.mosaic) + 10) / 10), 512));

    return {
        enabledEffects,
        u_color: (raw.color / 200) % 1,
        u_fisheye: Math.max(0, (raw.fisheye + 100) / 100),
        u_whirl: -raw.whirl * Math.PI / 180,
        u_pixelate: Math.abs(raw.pixelate) / 10,
        u_mosaic: mosaic,
        u_brightness: Math.max(-100, Math.min(raw.brightness, 100)) / 100,
        u_ghost: 1 - (Math.max(0, Math.min(raw.ghost, 100)) / 100)
    };
}

/**
 * EffectTransform.transformColor — ghost/color/brightness on a
 * premultiplied color4b. `effectMask` further restricts which effects run
 * (the color query passes `~ghost`).
 */
export function transformColor(
    state: CatnipEffectState,
    inOut: Uint8ClampedArray,
    effectMask?: number
): Uint8ClampedArray {
    if (inOut[3] === 0) return inOut;

    let effects = state.enabledEffects;
    if (typeof effectMask === "number") effects &= effectMask;

    const enableColor = (effects & EFFECT_MASK_COLOR) !== 0;
    const enableBrightness = (effects & EFFECT_MASK_BRIGHTNESS) !== 0;

    if (enableColor || enableBrightness) {
        // Undo premultiplication so HSV math sees straight colors (the
        // shader's `rgb / alpha`; a clamped Uint8Array dividing by 0 yields
        // 255, matching the comment in the ported source).
        const alpha = inOut[3] / 255;
        inOut[0] /= alpha;
        inOut[1] /= alpha;
        inOut[2] /= alpha;

        if (enableColor) {
            const hsv = rgbToHsv(inOut, [0, 0, 0]);
            const minV = 0.11 / 2.0;
            const minS = 0.09;
            if (hsv[2] < minV) {
                hsv[0] = 0;
                hsv[1] = 1;
                hsv[2] = minV;
            } else if (hsv[1] < minS) {
                hsv[0] = 0;
                hsv[1] = minS;
            }
            hsv[0] = state.u_color + hsv[0] + 1;
            hsvToRgb(hsv, inOut);
        }

        if (enableBrightness) {
            const brightness = state.u_brightness * 255;
            inOut[0] += brightness;
            inOut[1] += brightness;
            inOut[2] += brightness;
        }

        inOut[0] *= alpha;
        inOut[1] *= alpha;
        inOut[2] *= alpha;
    }

    if ((effects & EFFECT_MASK_GHOST) !== 0) {
        inOut[0] *= state.u_ghost;
        inOut[1] *= state.u_ghost;
        inOut[2] *= state.u_ghost;
        inOut[3] *= state.u_ghost;
    }

    return inOut;
}

/**
 * EffectTransform.transformPoint — maps a texture coordinate to the one the
 * shader would actually sample, in the shader's order (mosaic, pixelate,
 * whirl, fisheye). `skinSize` is the drawable's skin size in scratch units
 * (the pixelate uniform).
 */
export function transformPoint(
    state: CatnipEffectState,
    skinSize: readonly [number, number],
    x: number,
    y: number,
    dst: number[]
): number[] {
    dst[0] = x;
    dst[1] = y;

    const effects = state.enabledEffects;

    if ((effects & EFFECT_MASK_MOSAIC) !== 0) {
        dst[0] = state.u_mosaic * dst[0] % 1;
        dst[1] = state.u_mosaic * dst[1] % 1;
    }
    if ((effects & EFFECT_MASK_PIXELATE) !== 0) {
        const texelX = skinSize[0] / state.u_pixelate;
        const texelY = skinSize[1] / state.u_pixelate;
        dst[0] = (Math.floor(dst[0] * texelX) + CENTER_X) / texelX;
        dst[1] = (Math.floor(dst[1] * texelY) + CENTER_Y) / texelY;
    }
    if ((effects & EFFECT_MASK_WHIRL) !== 0) {
        const RADIUS = 0.5;
        const offsetX = dst[0] - CENTER_X;
        const offsetY = dst[1] - CENTER_Y;
        const offsetMagnitude = Math.sqrt(Math.pow(offsetX, 2) + Math.pow(offsetY, 2));
        const whirlFactor = Math.max(1.0 - (offsetMagnitude / RADIUS), 0.0);
        const whirlActual = state.u_whirl * whirlFactor * whirlFactor;
        const sinWhirl = Math.sin(whirlActual);
        const cosWhirl = Math.cos(whirlActual);
        const rot1 = cosWhirl;
        const rot2 = -sinWhirl;
        const rot3 = sinWhirl;
        const rot4 = cosWhirl;
        dst[0] = (rot1 * offsetX) + (rot3 * offsetY) + CENTER_X;
        dst[1] = (rot2 * offsetX) + (rot4 * offsetY) + CENTER_Y;
    }
    if ((effects & EFFECT_MASK_FISHEYE) !== 0) {
        const vX = (dst[0] - CENTER_X) / CENTER_X;
        const vY = (dst[1] - CENTER_Y) / CENTER_Y;
        const vLength = Math.sqrt((vX * vX) + (vY * vY));
        const r = Math.pow(Math.min(vLength, 1), state.u_fisheye) * Math.max(1, vLength);
        const unitX = vX / vLength;
        const unitY = vY / vLength;
        dst[0] = CENTER_X + (r * unitX * CENTER_X);
        dst[1] = CENTER_Y + (r * unitY * CENTER_Y);
    }

    return dst;
}
