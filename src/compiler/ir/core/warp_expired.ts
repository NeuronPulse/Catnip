import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrInputOpType } from "../../CatnipIrOp";
import { CatnipCompilerValue } from "../../CatnipCompilerValue";
import { CatnipValueFormat } from "../../CatnipValueFormat";

/** True once the current tick has used up its time budget. */
export const ir_warp_expired = new class extends CatnipIrInputOpType<{}> {
    public constructor() { super("core_warp_expired"); }

    public getOperandCount(): number { return 0; }

    public getResult(): CatnipCompilerValue {
        return CatnipCompilerValue.dynamic(CatnipValueFormat.I32_NUMBER);
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext): void {
        ctx.emitWasmGetRuntime();
        ctx.emitWasmRuntimeFunctionCall("catnip_runtime_warp_expired");
    }
}
