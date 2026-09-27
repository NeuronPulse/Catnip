import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type glide_begin_ir_inputs = { mode: "xy" | "to" };

export const ir_glide_begin = new class extends CatnipIrCommandOpType<glide_begin_ir_inputs> {
    public constructor() { super("motion_glide_begin"); }

    public getOperandCount(inputs: glide_begin_ir_inputs): number {
        // "xy": x, y, secs. "to": menu name, secs.
        return inputs.mode === "xy" ? 3 : 2;
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<glide_begin_ir_inputs, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall(
            ir.inputs.mode === "xy" ? "catnip_motion_glide_begin_xy" : "catnip_motion_glide_begin_to");
    }
}
