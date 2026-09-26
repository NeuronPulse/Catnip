import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";

/**
 * "Stop other scripts in sprite": every other thread running on this thread's
 * target ends; this one carries on, so unlike "stop all" this is an ordinary
 * command and the block after it still runs.
 */
export const ir_thread_stop_other_scripts = new class extends CatnipIrCommandOpType<{}> {
    public constructor() { super("core_thread_stop_other_scripts"); }

    public getOperandCount(): number { return 0; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<{}, {}>): void {
        ctx.emitWasmGetThread();
        ctx.emitWasmRuntimeFunctionCall("catnip_thread_stop_other_scripts");
    }
}
