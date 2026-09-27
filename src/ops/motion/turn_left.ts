import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_turn } from "../../compiler/ir/motion/turn";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";

type turn_inputs = { degrees: CatnipInputOp };

export const op_turn_left = new class extends CatnipCommandOpType<turn_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: turn_inputs): IterableIterator<CatnipOp> {
        yield inputs.degrees;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: turn_inputs): void {
        ctx.emitInput(inputs.degrees, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_turn, { direction: "left" }, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

registerSB3CommandBlock("motion_turnleft", (ctx, block) => op_turn_left.create({
    degrees: ctx.readInput(block.inputs.DEGREES),
}));
