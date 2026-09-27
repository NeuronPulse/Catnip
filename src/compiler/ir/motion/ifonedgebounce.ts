import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type ifonedgebounce_ir_inputs = { };

export const ir_ifonedgebounce = new class extends CatnipIrCommandOpType<ifonedgebounce_ir_inputs> {
    public constructor() { super("motion_ifonedgebounce"); }

    public getOperandCount(): number { return 0; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<ifonedgebounce_ir_inputs, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_motion_bounce");
    }
}
