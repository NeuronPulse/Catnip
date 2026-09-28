import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type clear_effects_ir_inputs = { };

export const ir_clear_effects = new class extends CatnipIrCommandOpType<clear_effects_ir_inputs> {
    public constructor() { super("looks_clear_effects"); }

    public getOperandCount(): number { return 0; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<clear_effects_ir_inputs, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_looks_clear_effects");
    }
}
