import { CatnipCompilerValue } from "../../CatnipCompilerValue";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrInputOp, CatnipIrInputOpType, CatnipIrOp } from "../../CatnipIrOp";
import { CatnipValueFormat } from "../../CatnipValueFormat";

/** Distance to the mouse or another sprite — the pushed current target is
 * the `self` argument (scratch: the stage asking always gives 10000). */
export const ir_sensing_distanceto = new class extends CatnipIrInputOpType<{}> {
    public constructor() { super("sensing_distanceto"); }

    public getOperandCount(): number { return 1; }

    public getResult(ir: CatnipIrOp): CatnipCompilerValue {
        return CatnipCompilerValue.dynamic(CatnipValueFormat.F64_NUMBER);
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrInputOp<{}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_sensing_distance_to");
    }
}
