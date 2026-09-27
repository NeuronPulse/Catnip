import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_goto } from "../../compiler/ir/motion/goto";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";

type goto_inputs = { to: CatnipInputOp };

export const op_goto = new class extends CatnipCommandOpType<goto_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: goto_inputs): IterableIterator<CatnipOp> {
        yield inputs.to;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: goto_inputs): void {
        ctx.emitInput(inputs.to, CatnipValueFormat.I32_HSTRING);
        ctx.emitIr(ir_goto, {}, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

registerSB3CommandBlock("motion_goto", (ctx, block) => op_goto.create({
    to: ctx.readInput(block.inputs.TO),
}));
