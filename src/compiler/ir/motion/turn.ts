import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type turn_ir_inputs = { direction: "left" | "right" };

export const ir_turn = new class extends CatnipIrCommandOpType<turn_ir_inputs> {
    public constructor() { super("motion_turn"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<turn_ir_inputs, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall(
            ir.inputs.direction === "left" ? "catnip_motion_turnleft" : "catnip_motion_turnright");
    }
}
