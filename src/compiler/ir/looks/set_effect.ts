import { SpiderNumberType } from "wasm-spider";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type set_effect_ir_inputs = { effect: number };

export const ir_set_effect = new class extends CatnipIrCommandOpType<set_effect_ir_inputs> {
    public constructor() { super("looks_set_effect"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<set_effect_ir_inputs, {}>): void {
        ctx.emitWasmConst(SpiderNumberType.i32, ir.inputs.effect);
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_looks_set_effect");
    }
}
