import { SpiderNumberType, SpiderOpcodes } from "wasm-spider";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";
import { CatnipCompilerCloneTriggerSubsystem } from "../../subsystems/CatnipCompilerCloneTriggerSubsystem";

/**
 * create clone of: the operand is the CLONE_OPTION menu as an hstring.
 * The runtime resolves it to the source target ("_myself_" is the target
 * running this script, anything else is a sprite name), scratch-vm's
 * makeClone copies the source, then — in scratch's order — the
 * "when I start as clone" hats start on the new target and it is placed
 * directly behind the source (goBehindOther). A null source (no such
 * sprite, the stage, or the 300-clone limit) runs none of that, exactly
 * like createClone bailing out before addTarget.
 */
export const ir_create_clone = new class extends CatnipIrCommandOpType<{}> {
    public constructor() { super("control_create_clone_of"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<{}>): void {
        const option = ctx.createLocal(SpiderNumberType.i32);
        const source = ctx.createLocal(SpiderNumberType.i32);
        const clone = ctx.createLocal(SpiderNumberType.i32);

        // The CLONE_OPTION hstring this op's operand left on the stack.
        ctx.emitWasm(SpiderOpcodes.local_set, option.ref);

        ctx.emitWasm(SpiderOpcodes.local_get, option.ref);
        ctx.emitWasmGetRuntime();
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_clone_resolve_source");
        ctx.emitWasm(SpiderOpcodes.local_set, source.ref);

        ctx.emitWasm(SpiderOpcodes.local_get, source.ref);
        ctx.emitWasmRuntimeFunctionCall("catnip_clone_create");
        // The clone pointer doubles as the guard: null means nothing
        // happened and the body below is skipped.
        ctx.emitWasm(SpiderOpcodes.local_tee, clone.ref);

        ctx.pushExpression();
            ctx.compiler.getSubsystem(CatnipCompilerCloneTriggerSubsystem)
                .emitStartCalls(ctx, clone.ref);
            ctx.emitWasm(SpiderOpcodes.local_get, clone.ref);
            ctx.emitWasm(SpiderOpcodes.local_get, source.ref);
            ctx.emitWasmRuntimeFunctionCall("catnip_looks_go_behind");
        ctx.emitWasm(SpiderOpcodes.if, ctx.popExpression());

        ctx.releaseLocal(clone);
        ctx.releaseLocal(source);
        ctx.releaseLocal(option);
    }
}
