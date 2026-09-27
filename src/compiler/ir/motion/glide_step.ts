import { SpiderOpcodes } from "wasm-spider";
import { CatnipCompilerState } from "../../CatnipCompilerState";
import { CatnipCompilerValue } from "../../CatnipCompilerValue";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrInputOp, CatnipIrInputOpType, CatnipIrOp, CatnipIrOpBranches } from "../../CatnipIrOp";
import { CatnipValueFormat } from "../../CatnipValueFormat";

export type glide_step_ir_inputs = { };

export const ir_glide_step = new class extends CatnipIrInputOpType<glide_step_ir_inputs> {
    public constructor() { super("motion_glide_step"); }

    public getOperandCount(): number { return 0; }

    public getResult(ir: CatnipIrOp<glide_step_ir_inputs, CatnipIrOpBranches<{}>>, state?: CatnipCompilerState): CatnipCompilerValue {
        return CatnipCompilerValue.dynamic(CatnipValueFormat.F64_NUMBER);
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<glide_step_ir_inputs, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_motion_glide_step");
    }
}
