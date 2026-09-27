import { SpiderOpcodes } from "wasm-spider";
import { CatnipCompilerState } from "../../CatnipCompilerState";
import { CatnipCompilerValue } from "../../CatnipCompilerValue";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrInputOp, CatnipIrInputOpType, CatnipIrOp, CatnipIrOpBranches } from "../../CatnipIrOp";
import { CatnipValueFormat } from "../../CatnipValueFormat";
import { CatnipWasmStructTarget } from "../../../wasm-interop/CatnipWasmStructTarget";

export type get_direction_ir_inputs = { };

export const ir_get_direction = new class extends CatnipIrInputOpType<get_direction_ir_inputs> {
    public constructor() { super("motion_get_direction"); }

    public getOperandCount(): number { return 0; }

    public getResult(ir: CatnipIrOp<get_direction_ir_inputs, CatnipIrOpBranches<{}>>, state?: CatnipCompilerState): CatnipCompilerValue {
        return CatnipCompilerValue.dynamic(CatnipValueFormat.F64_NUMBER);
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<get_direction_ir_inputs, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasm(SpiderOpcodes.f64_load, 3, CatnipWasmStructTarget.getMemberOffset("direction"));
    }
}
