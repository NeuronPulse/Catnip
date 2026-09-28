import { SpiderNumberType, SpiderOpcodes } from "wasm-spider";
import { CatnipCompilerValue } from "../../CatnipCompilerValue";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrInputOpType, CatnipIrOp } from "../../CatnipIrOp";
import { CatnipValueFormat } from "../../CatnipValueFormat";
import { CatnipValueFormatUtils } from "../../CatnipValueFormatUtils";
import { ir_convert } from "../core/convert";
import { CatnipWasmStructTarget } from "../../../wasm-interop/CatnipWasmStructTarget";

export type say_ir_inputs = { bubbleType: number };

const emitPushTypeAndCallSay = (ctx: CatnipCompilerWasmGenContext, bubbleType: number): void => {
    ctx.emitWasmConst(SpiderNumberType.i32, bubbleType);
    ctx.emitWasmGetCurrentTarget();
    ctx.emitWasmRuntimeFunctionCall("catnip_looks_say");
};

/**
 * say / think: the message on the stack becomes an hstring the way Scratch's
 * _formatBubbleText would render it — strings pass through, numbers go
 * through the two-decimal rounding for non-integers with |x| >= 0.01.
 */
export const ir_looks_say = new class extends CatnipIrCommandOpType<say_ir_inputs> {
    public constructor() { super("looks_say"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<say_ir_inputs, {}>): void {
        const fmt = ir.operands[0].format;

        if (CatnipValueFormatUtils.isAlways(fmt, CatnipValueFormat.I32_HSTRING)) {
            emitPushTypeAndCallSay(ctx, ir.inputs.bubbleType);
            return;
        }

        if (CatnipValueFormatUtils.isAlways(fmt, CatnipValueFormat.F64_NUMBER_OR_NAN)) {
            ctx.emitWasmGetRuntime();
            ctx.emitWasmRuntimeFunctionCall("catnip_looks_bubble_format");
            emitPushTypeAndCallSay(ctx, ir.inputs.bubbleType);
            return;
        }

        if (CatnipValueFormatUtils.isAlways(fmt, CatnipValueFormat.F64)) {
            const value = ctx.createLocal(SpiderNumberType.f64);
            ctx.emitWasm(SpiderOpcodes.local_tee, value.ref);

            ir_convert.emitStringCheck(ctx, fmt,
                (ctx, format) => {
                    ctx.emitWasm(SpiderOpcodes.local_get, value.ref);
                    ir_convert.emitConversion(ctx, format, CatnipValueFormat.I32_HSTRING);
                    emitPushTypeAndCallSay(ctx, ir.inputs.bubbleType);
                },
                (ctx, format) => {
                    ctx.emitWasm(SpiderOpcodes.local_get, value.ref);
                    ctx.emitWasmGetRuntime();
                    ctx.emitWasmRuntimeFunctionCall("catnip_looks_bubble_format");
                    emitPushTypeAndCallSay(ctx, ir.inputs.bubbleType);
                }
            );

            ctx.releaseLocal(value);
            return;
        }

        ir_convert.emitConversion(ctx, fmt, CatnipValueFormat.I32_HSTRING);
        emitPushTypeAndCallSay(ctx, ir.inputs.bubbleType);
    }
}

/** The current target's bubble generation — the usage id for sayforsecs. */
export const ir_looks_bubble_gen = new class extends CatnipIrInputOpType<{}> {
    public constructor() { super("looks_bubble_gen"); }

    public getOperandCount(): number { return 0; }

    public getResult(): CatnipCompilerValue {
        return CatnipCompilerValue.dynamic(CatnipValueFormat.I32_NUMBER);
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasm(SpiderOpcodes.i32_load, 2, CatnipWasmStructTarget.getMemberOffset("bubble_gen"));
    }
}

/** sayforsecs' deferred clear: only when no other say/think happened since. */
export const ir_looks_clear_if_unchanged = new class extends CatnipIrCommandOpType<{}> {
    public constructor() { super("looks_clear_if_unchanged"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<{}, {}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_looks_clear_if_unchanged");
    }
}
