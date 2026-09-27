import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_set_rotation_style } from "../../compiler/ir/motion/set_rotation_style";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";

type set_rotation_style_inputs = { style: CatnipInputOp };

export const op_set_rotation_style = new class extends CatnipCommandOpType<set_rotation_style_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: set_rotation_style_inputs): IterableIterator<CatnipOp> {
        yield inputs.style;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: set_rotation_style_inputs): void {
        ctx.emitInput(inputs.style, CatnipValueFormat.I32_HSTRING);
        ctx.emitIr(ir_set_rotation_style, {}, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

registerSB3CommandBlock("motion_setrotationstyle", (ctx, block) => op_set_rotation_style.create({
    style: ctx.readInput(block.inputs.STYLE),
}));
