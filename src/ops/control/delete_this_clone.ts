import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipCommandOpType, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_delete_clone } from "../../compiler/ir/control/delete_clone";

type delete_this_clone_inputs = {};

export const op_delete_this_clone = new class extends CatnipCommandOpType<delete_this_clone_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: delete_this_clone_inputs): IterableIterator<CatnipOp> { }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: delete_this_clone_inputs): void {
        ctx.emitIr(ir_delete_clone, {}, {});
    }
}

registerSB3CommandBlock("control_delete_this_clone", (ctx, block) => op_delete_this_clone.create({}));
