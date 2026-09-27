import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_point_direction } from "../../compiler/ir/motion/point_direction";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";

type point_direction_inputs = { direction: CatnipInputOp };

export const op_point_direction = new class extends CatnipCommandOpType<point_direction_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: point_direction_inputs): IterableIterator<CatnipOp> {
        yield inputs.direction;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: point_direction_inputs): void {
        ctx.emitInput(inputs.direction, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_point_direction, {}, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

registerSB3CommandBlock("motion_pointindirection", (ctx, block) => op_point_direction.create({
    direction: ctx.readInput(block.inputs.DIRECTION),
}));
