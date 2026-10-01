import { registerSB3CommandBlock, registerSB3InputBlock } from "../../sb3_ops";
import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipIr } from "../../compiler/CatnipIr";
import { op_const } from "../core/const";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";

type legacy_scroll_inputs = { distance: CatnipInputOp };

export const op_legacy_scroll_noop = new class extends CatnipCommandOpType<legacy_scroll_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: legacy_scroll_inputs): IterableIterator<CatnipOp> {
        yield inputs.distance;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: legacy_scroll_inputs): void {
        // The input still has to be evaluated (it may have side effects).
        ctx.emitInput(inputs.distance, CatnipValueFormat.F64_NUMBER);
    }
}

export const op_legacy_align_noop = new class extends CatnipCommandOpType<{}> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: {}): IterableIterator<CatnipOp> {}
    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: {}): void {}
}

registerSB3CommandBlock("motion_scroll_right", (ctx, block) => op_legacy_scroll_noop.create({
    distance: ctx.readInput(block.inputs.DISTANCE),
}));
registerSB3CommandBlock("motion_scroll_up", (ctx, block) => op_legacy_scroll_noop.create({
    distance: ctx.readInput(block.inputs.DISTANCE),
}));
registerSB3CommandBlock("motion_align_scene", () => op_legacy_align_noop.create({}));

// The Scratch 2 scroll reporters have no Scratch 3 equivalent: scratch-vm
// registers them as primitives returning undefined, so a converted project
// only ever shows an empty value. A constant 0 stands in for that.
registerSB3InputBlock("motion_xscroll", () => op_const.create({ value: 0 }));
registerSB3InputBlock("motion_yscroll", () => op_const.create({ value: 0 }));
