import { CatnipCompilerValue } from "../../CatnipCompilerValue";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrInputOp, CatnipIrInputOpType, CatnipIrOp } from "../../CatnipIrOp";
import { CatnipValueFormat } from "../../CatnipValueFormat";

/** (property) of (object): two string operands, the pushed current target
 * only supplies the runtime. Result is F64 — either a plain number or a
 * NaN-boxed string (costume/backdrop names), which conversions unbox. */
export const ir_sensing_of = new class extends CatnipIrInputOpType<{}> {
    public constructor() { super("sensing_of"); }

    public getOperandCount(): number { return 2; }

    public getResult(ir: CatnipIrOp): CatnipCompilerValue {
        return CatnipCompilerValue.dynamic(CatnipValueFormat.F64);
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrInputOp<{}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_sensing_of");
    }
}
