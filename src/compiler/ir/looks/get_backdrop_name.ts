import { CatnipCompilerValue } from "../../CatnipCompilerValue";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrInputOp, CatnipIrInputOpType, CatnipIrOp } from "../../CatnipIrOp";
import { CatnipValueFormat } from "../../CatnipValueFormat";

export const ir_get_backdrop_name = new class extends CatnipIrInputOpType {
    public constructor() { super("looks_get_backdrop_name"); }

    public getOperandCount(): number {
        return 0;
    }

    public getResult(ir: CatnipIrOp): CatnipCompilerValue {
        return CatnipCompilerValue.dynamic(CatnipValueFormat.I32_HSTRING);
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrInputOp): void {
        ctx.emitWasmGetRuntime();
        ctx.emitWasmRuntimeFunctionCall("catnip_looks_backdrop_name");
    }
}
