import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type point_direction_ir_inputs = { };

export const ir_point_direction = new class extends CatnipIrCommandOpType<point_direction_ir_inputs> {
    public constructor() { super("motion_point_direction"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<point_direction_ir_inputs, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_motion_point_direction");
    }
}
