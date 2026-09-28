import { SpiderNumberType } from "wasm-spider";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type set_visible_ir_inputs = { visible: boolean };

export const ir_set_visible = new class extends CatnipIrCommandOpType<set_visible_ir_inputs> {
    public constructor() { super("looks_set_visible"); }

    public getOperandCount(): number { return 0; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<set_visible_ir_inputs, {}>): void {
        ctx.emitWasmConst(SpiderNumberType.i32, ir.inputs.visible ? 1 : 0);
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_looks_set_visible");
    }
}
