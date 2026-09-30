import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

/** sensing set drag mode: one f64 operand (1 = draggable, 0 = not), the
 *  pushed current target as the C function's last argument. */
export const ir_sensing_set_drag_mode = new class extends CatnipIrCommandOpType<{}> {
    public constructor() { super("sensing_set_drag_mode"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<{}, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_sensing_set_drag_mode");
    }
}
