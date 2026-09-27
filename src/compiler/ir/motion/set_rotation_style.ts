import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type set_rotation_style_ir_inputs = { };

export const ir_set_rotation_style = new class extends CatnipIrCommandOpType<set_rotation_style_ir_inputs> {
    public constructor() { super("motion_set_rotation_style"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<set_rotation_style_ir_inputs, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_motion_set_rotation_style");
    }
}
