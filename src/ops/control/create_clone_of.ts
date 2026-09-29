import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_create_clone } from "../../compiler/ir/control/create_clone";

type create_clone_of_inputs = { cloneOption: CatnipInputOp };

export const op_create_clone_of = new class extends CatnipCommandOpType<create_clone_of_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: create_clone_of_inputs): IterableIterator<CatnipOp> {
        yield inputs.cloneOption;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: create_clone_of_inputs): void {
        ctx.emitInput(inputs.cloneOption, CatnipValueFormat.I32_HSTRING);
        ctx.emitIr(ir_create_clone, {}, {});
    }
}

registerSB3CommandBlock("control_create_clone_of", (ctx, block) => op_create_clone_of.create({
    cloneOption: ctx.readInput(block.inputs.CLONE_OPTION),
}));
