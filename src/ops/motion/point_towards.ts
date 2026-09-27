import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_point_towards } from "../../compiler/ir/motion/point_towards";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";

type point_towards_inputs = { towards: CatnipInputOp };

export const op_point_towards = new class extends CatnipCommandOpType<point_towards_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: point_towards_inputs): IterableIterator<CatnipOp> {
        yield inputs.towards;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: point_towards_inputs): void {
        ctx.emitInput(inputs.towards, CatnipValueFormat.I32_HSTRING);
        ctx.emitIr(ir_point_towards, {}, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

registerSB3CommandBlock("motion_pointtowards", (ctx, block) => op_point_towards.create({
    towards: ctx.readInput(block.inputs.TOWARDS),
}));
