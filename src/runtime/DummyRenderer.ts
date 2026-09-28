import { ICatnipRenderer } from "./ICatnipRenderer";

export class DummyRenderer implements ICatnipRenderer {

    penDrawLines(data: Float32Array, length: number): void { }
    penEraseAll(): void { }
    drawState(data: Float32Array): void { }
    layer(data: Int32Array): void { }
    frame(): void { }

}