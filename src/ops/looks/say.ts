import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { ir_looks_say, ir_looks_bubble_gen, ir_looks_clear_if_unchanged } from "../../compiler/ir/looks/say";
import { ir_time_get } from "../../compiler/ir/sensing/time_get";
import { ir_mul } from "../../compiler/ir/operators/mul";
import { ir_add } from "../../compiler/ir/operators/add";
import { ir_transient_store } from "../../compiler/ir/core/transient_store";
import { ir_transient_load } from "../../compiler/ir/core/transient_load";
import { ir_yield } from "../../compiler/ir/core/yield";
import { ir_branch } from "../../compiler/ir/core/branch";
import { ir_cmp_lt } from "../../compiler/ir/operators/cmp_lt";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";
import { CatnipWasmEnumThreadStatus } from "../../wasm-interop/CatnipWasmEnumThreadStatus";
import { CATNIP_BUBBLE_SAY, CATNIP_BUBBLE_THINK } from "../../wasm-interop/CatnipWasmStructTarget";

type say_inputs = { msg: CatnipInputOp, bubbleType: number };

export const op_say = new class extends CatnipCommandOpType<say_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: say_inputs): IterableIterator<CatnipOp> {
        yield inputs.msg;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: say_inputs): void {
        ctx.emitInput(inputs.msg);
        ctx.emitIr(ir_looks_say, { bubbleType: inputs.bubbleType }, {});
    }
}

type sayforsecs_inputs = { msg: CatnipInputOp, secs: CatnipInputOp, bubbleType: number };

export const op_sayforsecs = new class extends CatnipCommandOpType<sayforsecs_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: sayforsecs_inputs): IterableIterator<CatnipOp> {
        yield inputs.msg;
        yield inputs.secs;
    }

    public isYielding(ir: CatnipIr, inputs: sayforsecs_inputs): boolean {
        return true;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: sayforsecs_inputs): void {
        // Say first, remembering the generation this call produced; the clear
        // at the end only fires when no other say/think bumped it meanwhile —
        // Scratch's usageId comparison in sayforsecs.
        ctx.emitInput(inputs.msg);
        ctx.emitIr(ir_looks_say, { bubbleType: inputs.bubbleType }, {});
        ctx.emitIr(ir_looks_bubble_gen, {}, {});
        const usage = ctx.emitTransientCreate(CatnipValueFormat.I32_NUMBER, "bubble_usage");
        ctx.emitIr(ir_transient_store, { transient: usage }, {});

        // Wait, exactly like control_wait: seconds to a millisecond deadline.
        ctx.emitInput(inputs.secs);
        ctx.emitIrConst(1000, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_mul, {}, {});
        ctx.emitIr(ir_time_get, {}, {});
        ctx.emitIr(ir_add, {}, {});

        const deadline = ctx.emitTransientCreate(CatnipValueFormat.F64_NUMBER, "bubble_deadline");
        ctx.emitIr(ir_transient_store, { transient: deadline }, {});

        const loopBranch = ctx.emitBranch((block) => {
            ctx.emitIr(ir_time_get, {}, {});
            ctx.emitIr(ir_transient_load, { transient: deadline }, {});
            ctx.emitIr(ir_cmp_lt, {}, {});
            ctx.emitConditionalJump(block, CatnipWasmEnumThreadStatus.YIELD);
        });

        ctx.emitIr(ir_request_redraw, {}, {});
        ctx.emitIr(ir_yield, { status: CatnipWasmEnumThreadStatus.YIELD }, { branch: loopBranch });

        ctx.emitIr(ir_transient_load, { transient: usage }, {});
        ctx.emitIr(ir_looks_clear_if_unchanged, {}, {});
    }
}

registerSB3CommandBlock("looks_say", (ctx, block) =>
    op_say.create({
        msg: ctx.readInput(block.inputs.MESSAGE),
        bubbleType: CATNIP_BUBBLE_SAY,
    }));

registerSB3CommandBlock("looks_think", (ctx, block) =>
    op_say.create({
        msg: ctx.readInput(block.inputs.MESSAGE),
        bubbleType: CATNIP_BUBBLE_THINK,
    }));

registerSB3CommandBlock("looks_sayforsecs", (ctx, block) =>
    op_sayforsecs.create({
        msg: ctx.readInput(block.inputs.MESSAGE),
        secs: ctx.readInput(block.inputs.SECS),
        bubbleType: CATNIP_BUBBLE_SAY,
    }));

registerSB3CommandBlock("looks_thinkforsecs", (ctx, block) =>
    op_sayforsecs.create({
        msg: ctx.readInput(block.inputs.MESSAGE),
        secs: ctx.readInput(block.inputs.SECS),
        bubbleType: CATNIP_BUBBLE_THINK,
    }));
