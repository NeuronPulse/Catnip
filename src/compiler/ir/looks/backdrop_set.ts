import { SpiderNumberType, SpiderOpcodes } from "wasm-spider";
import { CatnipWasmPtrThread } from "../../../wasm-interop/CatnipWasmStructThread";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";
import { CatnipIrTransientVariable } from "../../CatnipIrTransientVariable";
import { CatnipValueFormat } from "../../CatnipValueFormat";
import { CatnipCompilerBackdropSubsystem } from "../../subsystems/CatnipCompilerBackdropSubsystem";
import { ir_convert } from "../core/convert";

/**
 * Hands the switched-to backdrop name (the C call's return value, still on
 * the stack) to the when-backdrop-switches-to dispatcher, together with the
 * thread list an "and wait" block will poll (0 for a plain switch). With no
 * hat registered the name is simply dropped.
 */
export function emitBackdropDispatch(ctx: CatnipCompilerWasmGenContext, threadListVariable: CatnipIrTransientVariable | null): void {
    const subsystem = ctx.compiler.getSubsystem(CatnipCompilerBackdropSubsystem);
    const nameLocal = ctx.createLocal(SpiderNumberType.i32);
    ctx.emitWasm(SpiderOpcodes.local_set, nameLocal.ref);

    ctx.emitWasm(SpiderOpcodes.local_get, nameLocal.ref);

    if (threadListVariable !== null) {
        ctx.emitWasmConst(SpiderNumberType.i32, CatnipWasmPtrThread.size);
        ctx.emitWasmConst(SpiderNumberType.i32, 4);
        ctx.emitWasmRuntimeFunctionCall("catnip_list_new");
        ctx.emitWasm(SpiderOpcodes.local_tee, ctx.getTransientVariableRef(threadListVariable));
    } else {
        ctx.emitWasmConst(SpiderNumberType.i32, 0);
    }

    if (subsystem.hasTriggers()) {
        ctx.emitWasm(SpiderOpcodes.call, subsystem.getDispatchFunction());
    } else {
        ctx.emitWasm(SpiderOpcodes.drop);
        ctx.emitWasm(SpiderOpcodes.drop);
    }

    ctx.releaseLocal(nameLocal);
}

export type backdrop_set_ir_inputs = { threadListVariable: CatnipIrTransientVariable | null };

export const ir_backdrop_set = new class extends CatnipIrCommandOpType<backdrop_set_ir_inputs> {
    public constructor() { super("looks_backdrop_set"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<backdrop_set_ir_inputs>): void {
        // Backdrop names and numeric strings both go through the string path
        // of catnip_blockutil_backdrop_set (numbers parse as indices there).
        ir_convert.emitConversion(ctx, ir.operands[0].format, CatnipValueFormat.I32_HSTRING);
        ctx.emitWasmGetRuntime();
        ctx.emitWasmRuntimeFunctionCall("catnip_looks_backdrop_set");

        emitBackdropDispatch(ctx, ir.inputs.threadListVariable);
    }

    public *getTransientVariables(ir: CatnipIrOp<backdrop_set_ir_inputs>): IterableIterator<CatnipIrTransientVariable> {
        if (ir.inputs.threadListVariable !== null)
            yield ir.inputs.threadListVariable;
    }
}
