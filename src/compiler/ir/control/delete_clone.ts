import { SpiderNumberType, SpiderOpcodes } from "wasm-spider";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";
import { CatnipWasmEnumThreadStatus } from "../../../wasm-interop/CatnipWasmEnumThreadStatus";
import { CatnipWasmStructThread } from "../../../wasm-interop/CatnipWasmStructThread";

/**
 * delete this clone: C disposes the running target when it is a clone
 * (scratch3_control.deleteClone — every other thread on it stops, the
 * target is unlinked and freed) and returns 1. On the original it is the
 * no-op scratch's `if (util.target.isOriginal) return` makes of it, and the
 * script falls through. When it did delete, the calling thread ends here
 * the way every script end does: status TERMINATED, stack rewound, return —
 * nothing after this block in the script runs, as in scratch where
 * stopForTarget ends the current thread too.
 */
export const ir_delete_clone = new class extends CatnipIrCommandOpType<{}> {
    public constructor() { super("control_delete_this_clone"); }

    public getOperandCount(): number { return 0; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<{}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_clone_delete");

        ctx.pushExpression();
            ctx.emitWasmGetThread();
            ctx.emitWasmConst(SpiderNumberType.i32, CatnipWasmEnumThreadStatus.TERMINATED);
            ctx.emitWasm(SpiderOpcodes.i32_store, 2, CatnipWasmStructThread.getMemberOffset("status"));
            ctx.cleanStack();
            ctx.emitWasm(SpiderOpcodes.return);
        ctx.emitWasm(SpiderOpcodes.if, ctx.popExpression());
    }

    public isBarrier(): boolean { return true; }
}
