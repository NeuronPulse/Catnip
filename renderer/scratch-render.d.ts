/**
 * The subset of scratch-render's RenderWebGL that Catnip uses. The package
 * ships plain JavaScript; this declaration describes its public API as found
 * in node_modules/scratch-render/src/RenderWebGL.js (2.2.84).
 */
declare module "scratch-render" {

    interface PenAttributes {
        /** The pen line's diameter in stage units. */
        diameter?: number;
        /** Pen color, each component in [0,1]. */
        color4f?: [number, number, number, number];
    }

    class RenderWebGL {
        constructor(
            canvas: HTMLCanvasElement,
            xLeft?: number, xRight?: number, yBottom?: number, yTop?: number
        );

        /** Must be called before createDrawable; mirrors scratch-vm's attachRenderer. */
        setLayerGroupOrdering(groupOrdering: string[]): void;

        createDrawable(group: string): number;
        destroyDrawable(drawableID: number, group: string): void;

        /** Topmost visible drawable under a canvas-relative CSS-pixel point, or -1. */
        pick(centerX: number, centerY: number, touchWidth?: number, touchHeight?: number, candidateIDs?: number[]): number;

        updateDrawableSkinId(drawableID: number, skinId: number): void;
        updateDrawablePosition(drawableID: number, position: [number, number]): void;
        updateDrawableDirectionScale(drawableID: number, direction: number, scale: [number, number]): void;
        updateDrawableVisible(drawableID: number, visible: boolean): void;
        updateDrawableEffect(drawableID: number, effectName: string, value: number): void;
        setDrawableOrder(drawableID: number, order: number, group?: string, optIsRelative?: boolean, optMin?: number): number;

        createSVGSkin(svgData: string, rotationCenter?: [number, number]): number;
        createBitmapSkin(
            bitmapData: HTMLImageElement | HTMLCanvasElement | ImageData,
            costumeResolution?: number,
            rotationCenter?: [number, number]
        ): number;
        createPenSkin(): number;
        getSkinSize(skinID: number): [number, number];
        getSkinRotationCenter(skinID: number): [number, number];

        penClear(penSkinID: number): void;
        penLine(penSkinID: number, penAttributes: PenAttributes, x0: number, y0: number, x1: number, y1: number): void;
        penStamp(penSkinID: number, stampID: number): void;

        setBackgroundColor(red: number, green: number, blue: number): void;
        resize(pixelsWide: number, pixelsTall: number): void;
        draw(): void;
    }

    export = RenderWebGL;
}
