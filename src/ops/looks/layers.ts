import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipIr } from "../../compiler/CatnipIr";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { ir_change_layer } from "../../compiler/ir/looks/change_layer";
import { ir_goto_frontback } from "../../compiler/ir/looks/goto_frontback";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";

type goto_frontback_inputs = { front: boolean };

export const op_goto_frontback = new class extends CatnipCommandOpType<goto_frontback_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: goto_frontback_inputs): IterableIterator<CatnipOp> {}

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: goto_frontback_inputs): void {
        ctx.emitIr(ir_goto_frontback, { front: inputs.front }, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

type change_layer_inputs = { backward: boolean, num: CatnipInputOp };

export const op_change_layer = new class extends CatnipCommandOpType<change_layer_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: change_layer_inputs): IterableIterator<CatnipOp> {
        yield inputs.num;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: change_layer_inputs): void {
        ctx.emitInput(inputs.num, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_change_layer, { backward: inputs.backward }, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

registerSB3CommandBlock("looks_gotofrontback", (ctx, block) => op_goto_frontback.create({
    front: block.fields.FRONT_BACK[0] === "front",
}));

registerSB3CommandBlock("looks_goforwardbackwardlayers", (ctx, block) => op_change_layer.create({
    backward: block.fields.FORWARD_BACKWARD[0] === "backward",
    num: ctx.readInput(block.inputs.NUM),
}));
