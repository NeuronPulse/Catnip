import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";
import { ir_set_visible } from "../../compiler/ir/looks/set_visible";
import { CatnipCommandOpType, CatnipOp } from "../CatnipOp";

type show_hide_inputs = {};

export const op_show = new class extends CatnipCommandOpType<show_hide_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: show_hide_inputs): IterableIterator<CatnipOp> {}

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: show_hide_inputs): void {
        ctx.emitIr(ir_set_visible, { visible: true }, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

export const op_hide = new class extends CatnipCommandOpType<show_hide_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: show_hide_inputs): IterableIterator<CatnipOp> {}

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: show_hide_inputs): void {
        ctx.emitIr(ir_set_visible, { visible: false }, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

// Scratch's hide-all-sprites is a legacy no-op (scratch3_looks.js registers
// it as `() => {}`); the opcode still has to exist so projects load.
export const op_hide_all_sprites = new class extends CatnipCommandOpType<show_hide_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: show_hide_inputs): IterableIterator<CatnipOp> {}

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: show_hide_inputs): void {}
}

registerSB3CommandBlock("looks_show", () => op_show.create({}));
registerSB3CommandBlock("looks_hide", () => op_hide.create({}));
registerSB3CommandBlock("looks_hideallsprites", () => op_hide_all_sprites.create({}));
