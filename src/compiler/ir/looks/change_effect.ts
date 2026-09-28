import { SpiderNumberType } from "wasm-spider";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type change_effect_ir_inputs = { effect: number };

export const ir_change_effect = new class extends CatnipIrCommandOpType<change_effect_ir_inputs> {
    public constructor() { super("looks_change_effect"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<change_effect_ir_inputs, {}>): void {
        ctx.emitWasmConst(SpiderNumberType.i32, ir.inputs.effect);
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_looks_change_effect");
    }
}
