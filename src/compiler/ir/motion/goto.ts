import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type goto_ir_inputs = { };

export const ir_goto = new class extends CatnipIrCommandOpType<goto_ir_inputs> {
    public constructor() { super("motion_goto"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<goto_ir_inputs, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_motion_goto");
    }
}
