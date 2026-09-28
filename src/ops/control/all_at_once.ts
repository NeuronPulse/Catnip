import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipCommandOpType, CatnipCommandList, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_branch } from "../../compiler/ir/core/branch";

type all_at_once_inputs = { substack: CatnipCommandList };

export const op_all_at_once = new class extends CatnipCommandOpType<all_at_once_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: all_at_once_inputs): IterableIterator<CatnipOp | CatnipCommandList> {
        yield inputs.substack;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: all_at_once_inputs): void {
        // scratch-vm allAtOnce: a Scratch 2.0 compatibility block that runs the
        // contained script like "if 1 = 1" — a plain branch, no warping.
        ctx.emitIr(ir_branch, {}, { branch: ctx.emitBranch(inputs.substack) });
    }
}

registerSB3CommandBlock("control_all_at_once", (ctx, block) =>
    op_all_at_once.create({
        substack: ctx.readStack(block.inputs.SUBSTACK),
    })
);
