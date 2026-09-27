import { CatnipInputOpType, CatnipOp } from "../CatnipOp";
import { registerSB3InputBlock } from "../../sb3_ops";
import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { ir_get_direction } from "../../compiler/ir/motion/get_direction";

export const op_get_direction = new class extends CatnipInputOpType<{}> {
    public *getInputsAndSubstacks(): IterableIterator<CatnipOp> { }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: {}) {
        ctx.emitIr(ir_get_direction, {}, {});
    }
}

registerSB3InputBlock("motion_direction", () => op_get_direction.create({}));
