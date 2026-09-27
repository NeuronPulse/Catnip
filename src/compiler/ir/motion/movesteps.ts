import { SpiderOpcodes } from "wasm-spider";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

export type movesteps_ir_inputs = { };

export const ir_movesteps = new class extends CatnipIrCommandOpType<movesteps_ir_inputs> {
    public constructor() { super("motion_movesteps"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<movesteps_ir_inputs, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_motion_movesteps");
    }
}
