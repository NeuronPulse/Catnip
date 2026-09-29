import { ICatnipRenderer } from "./ICatnipRenderer";

export class DummyRenderer implements ICatnipRenderer {

    penDrawLines(data: Float32Array, length: number): void { }
    penEraseAll(): void { }
    drawState(data: Float32Array): void { }
    layer(data: Int32Array): void { }
    bubble(data: import("./ICatnipRenderer").CatnipBubbleUpdate[]): void { }
    cloneAdd(slot: number, spriteIndex: number): void { }
    cloneRemove(slot: number): void { }
    frame(): void { }

}