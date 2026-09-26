import { SpiderOpcodes } from "wasm-spider";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

/**
 * "Stop all": every thread in the runtime ends, this one included, so the
 * runtime has to be told to return from the script right away — it will not
 * call this thread again.
 */
export const ir_thread_stop_all = new class extends CatnipIrCommandOpType<{}> {
    public constructor() { super("core_thread_stop_all"); }

    public getOperandCount(): number { return 0; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<{}, {}>): void {
        ctx.emitWasmGetThread();
        ctx.emitWasmRuntimeFunctionCall("catnip_thread_stop_all");

        ctx.cleanStack();
        ctx.emitWasm(SpiderOpcodes.return);
    }

    public doesContinue() { return false; }

    public isBarrier() { return true; }
}
