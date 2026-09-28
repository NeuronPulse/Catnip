import { SpiderNumberType, SpiderOpcodes } from "wasm-spider";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type change_layer_ir_inputs = { backward: boolean };

export const ir_change_layer = new class extends CatnipIrCommandOpType<change_layer_ir_inputs> {
    public constructor() { super("looks_change_layer"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<change_layer_ir_inputs, {}>): void {
        // The operand is the layer count; negate it for "backward" the way
        // RenderedTarget.goBackwardLayers passes -nLayers to the renderer.
        if (ir.inputs.backward) {
            ctx.emitWasmConst(SpiderNumberType.f64, -1);
            ctx.emitWasm(SpiderOpcodes.f64_mul);
        }

        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_looks_change_layer");
    }
}
