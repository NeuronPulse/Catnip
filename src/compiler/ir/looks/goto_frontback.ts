import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type goto_frontback_ir_inputs = { front: boolean };

export const ir_goto_frontback = new class extends CatnipIrCommandOpType<goto_frontback_ir_inputs> {
    public constructor() { super("looks_goto_frontback"); }

    public getOperandCount(): number { return 0; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<goto_frontback_ir_inputs, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall(
            ir.inputs.front ? "catnip_looks_goto_front" : "catnip_looks_goto_back");
    }
}
