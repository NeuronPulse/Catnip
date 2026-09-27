import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_movesteps } from "../../compiler/ir/motion/movesteps";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";

type movesteps_inputs = { steps: CatnipInputOp };

export const op_movesteps = new class extends CatnipCommandOpType<movesteps_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: movesteps_inputs): IterableIterator<CatnipOp> {
        yield inputs.steps;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: movesteps_inputs): void {
        ctx.emitInput(inputs.steps, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_movesteps, {}, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

registerSB3CommandBlock("motion_movesteps", (ctx, block) => op_movesteps.create({
    steps: ctx.readInput(block.inputs.STEPS),
}));
