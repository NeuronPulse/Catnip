import { SpiderNumberType, SpiderOpcodes } from "wasm-spider";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";
import { CatnipWasmEnumThreadStatus } from "../../../wasm-interop/CatnipWasmEnumThreadStatus";
import { CatnipWasmStructRuntime } from "../../../wasm-interop/CatnipWasmStructRuntime";
import { CatnipWasmStructThread } from "../../../wasm-interop/CatnipWasmStructThread";

export type ir_whengreaterthan_poll_inputs = {
    readonly key: number;
};

/**
 * The head of a "when timer > N" script: compare the project timer with the
 * threshold (operand), store the predicate under this hat's key on the live
 * target, and retire here unless the value rose from false to true this
 * frame. Falling through starts the script, exactly like scratch's
 * execute.js handleReport letting an edge-activated hat thread continue.
 */
export const ir_whengreaterthan_poll = new class extends CatnipIrCommandOpType<ir_whengreaterthan_poll_inputs> {
    public constructor() { super("event_whengreaterthan"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<ir_whengreaterthan_poll_inputs>): void {
        const threshold = ctx.createLocal(SpiderNumberType.f64);
        ctx.emitWasm(SpiderOpcodes.local_set, threshold.ref);

        // The poll runs inside the hat's own thread, so a clone polls itself
        // the way scratch's predicate runs on util.target.
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmConst(SpiderNumberType.i32, ir.inputs.key);

        // Project timer in seconds — the same expression ir_timer_get emits.
        ctx.emitWasmGetRuntime();
        ctx.emitWasm(SpiderOpcodes.i64_load, 3, CatnipWasmStructRuntime.getMemberOffset("time"));
        ctx.emitWasmGetRuntime();
        ctx.emitWasm(SpiderOpcodes.i64_load, 3, CatnipWasmStructRuntime.getMemberOffset("timer_start"));
        ctx.emitWasm(SpiderOpcodes.i64_sub);
        ctx.emitWasm(SpiderOpcodes.f64_convert_i64_u);
        ctx.emitWasmConst(SpiderNumberType.f64, 1000);
        ctx.emitWasm(SpiderOpcodes.f64_div);

        ctx.emitWasm(SpiderOpcodes.local_get, threshold.ref);
        ctx.emitWasm(SpiderOpcodes.f64_gt);

        // (target, key, predicate): catnip_edge_hat_poll keeps the edge state
        // and answers whether the rising edge fired.
        ctx.emitWasmRuntimeFunctionCall("catnip_edge_hat_poll");
        ctx.releaseLocal(threshold);

        // No edge this frame: end the thread without running the script, the
        // way scratch retires a hat whose predicate (or edge) did not hold.
        ctx.emitWasm(SpiderOpcodes.i32_eqz);
        ctx.pushExpression();
            ctx.emitWasmGetThread();
            ctx.emitWasmConst(SpiderNumberType.i32, CatnipWasmEnumThreadStatus.TERMINATED);
            ctx.emitWasm(SpiderOpcodes.i32_store, 2, CatnipWasmStructThread.getMemberOffset("status"));
            ctx.cleanStack();
            ctx.emitWasm(SpiderOpcodes.return);
        ctx.emitWasm(SpiderOpcodes.if, ctx.popExpression());
    }

    public isBarrier(): boolean { return true; }
};
