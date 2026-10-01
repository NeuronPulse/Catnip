import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_change_effect } from "../../compiler/ir/looks/change_effect";
import { ir_clear_effects } from "../../compiler/ir/looks/clear_effects";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";
import { ir_set_effect } from "../../compiler/ir/looks/set_effect";
import { CatnipInputOp, CatnipCommandOpType, CatnipOp } from "../CatnipOp";

/** Matches CATNIP_EFFECT_* in module/catnip_looks.h (struct field order). */
const EFFECT_INDEXES: Record<string, number> = {
    color: 0,
    fisheye: 1,
    whirl: 2,
    pixelate: 3,
    mosaic: 4,
    brightness: 5,
    ghost: 6,
};

// The effect dropdown is a fixed menu, so the field is always a constant
// string; scratch3_looks.js lowercases it before the lookup too. An unknown
// name still reaches RenderedTarget.setEffect, whose hasOwnProperty guard
// turns it into a no-op — index -1 does the same in the C side.
function effectIndex(raw: string | number | boolean): number {
    const index = EFFECT_INDEXES[String(raw).toLowerCase()];
    if (index === undefined)
        return -1;
    return index;
}

type set_effect_inputs = { effect: number, value: CatnipInputOp };
type change_effect_inputs = { effect: number, change: CatnipInputOp };
type clear_effects_inputs = {};

export const op_set_effect = new class extends CatnipCommandOpType<set_effect_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: set_effect_inputs): IterableIterator<CatnipOp> {
        yield inputs.value;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: set_effect_inputs): void {
        ctx.emitInput(inputs.value, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_set_effect, { effect: inputs.effect }, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

export const op_change_effect = new class extends CatnipCommandOpType<change_effect_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: change_effect_inputs): IterableIterator<CatnipOp> {
        yield inputs.change;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: change_effect_inputs): void {
        ctx.emitInput(inputs.change, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_change_effect, { effect: inputs.effect }, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

export const op_clear_effects = new class extends CatnipCommandOpType<clear_effects_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: clear_effects_inputs): IterableIterator<CatnipOp> {}

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: clear_effects_inputs): void {
        ctx.emitIr(ir_clear_effects, {}, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

registerSB3CommandBlock("looks_seteffectto", (ctx, block) => op_set_effect.create({
    effect: effectIndex(block.fields.EFFECT[0]),
    value: ctx.readInput(block.inputs.VALUE),
}));
registerSB3CommandBlock("looks_changeeffectby", (ctx, block) => op_change_effect.create({
    effect: effectIndex(block.fields.EFFECT[0]),
    change: ctx.readInput(block.inputs.CHANGE),
}));
registerSB3CommandBlock("looks_cleargraphiceffects", () => op_clear_effects.create({}));
