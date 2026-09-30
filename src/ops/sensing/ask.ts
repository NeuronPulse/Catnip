import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipCommandOpType, CatnipInputOp, CatnipInputOpType, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock, registerSB3InputBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_branch } from "../../compiler/ir/core/branch";
import { ir_not } from "../../compiler/ir/operators/not";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";
import { ir_transient_store } from "../../compiler/ir/core/transient_store";
import { ir_transient_load } from "../../compiler/ir/core/transient_load";
import { ir_sensing_ask, ir_sensing_ask_done, ir_sensing_answer_get } from "../../compiler/ir/sensing/ask";
import { CatnipWasmEnumThreadStatus } from "../../wasm-interop/CatnipWasmEnumThreadStatus";

type ask_inputs = { question: CatnipInputOp };

export const op_ask = new class extends CatnipCommandOpType<ask_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: ask_inputs): IterableIterator<CatnipOp> {
        yield inputs.question;
    }

    public isYielding(ir: CatnipIr, inputs: ask_inputs): boolean {
        return true;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: ask_inputs): void {
        // scratch-vm askAndWait: enqueue (the question goes on screen when it
        // reaches the head of the queue), then park the thread until the host
        // answers — the wait loop is control_wait_until's, on the ticket.
        ctx.emitInput(inputs.question, CatnipValueFormat.I32_HSTRING);
        ctx.emitIr(ir_sensing_ask, {}, {});

        const ticket = ctx.emitTransientCreate(CatnipValueFormat.I32_NUMBER, "ask_ticket");
        ctx.emitIr(ir_transient_store, { transient: ticket }, {});

        const loopBranch = ctx.emitBranch((block) => {
            ctx.emitIr(ir_request_redraw, {}, {});
            ctx.emitIr(ir_transient_load, { transient: ticket }, {});
            ctx.emitIr(ir_sensing_ask_done, {}, {});
            ctx.emitIr(ir_not, {}, {});
            ctx.emitConditionalJump(block, CatnipWasmEnumThreadStatus.YIELD);
        });

        ctx.emitIr(ir_branch, {}, { branch: loopBranch });
    }
}

type answer_inputs = {};

export const op_answer = new class extends CatnipInputOpType<answer_inputs> {
    public *getInputsAndSubstacks(): IterableIterator<CatnipOp> { }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: answer_inputs): void {
        ctx.emitIr(ir_sensing_answer_get, {}, {});
    }
}

registerSB3CommandBlock("sensing_askandwait", (ctx, block) =>
    op_ask.create({
        question: ctx.readInput(block.inputs.QUESTION),
    })
);

registerSB3InputBlock("sensing_answer", () => op_answer.create({}));
