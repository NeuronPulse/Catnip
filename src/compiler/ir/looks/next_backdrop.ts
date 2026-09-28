import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type next_backdrop_ir_inputs = { };

export const ir_next_backdrop = new class extends CatnipIrCommandOpType<next_backdrop_ir_inputs> {
    public constructor() { super("looks_next_backdrop"); }

    public getOperandCount(): number { return 0; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<next_backdrop_ir_inputs, {}>): void {
        ctx.emitWasmGetRuntime();
        ctx.emitWasmRuntimeFunctionCall("catnip_looks_next_backdrop");
    }
}
