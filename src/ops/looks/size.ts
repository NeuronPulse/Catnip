import { registerSB3CommandBlock, registerSB3InputBlock } from "../../sb3_ops";
import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";
import { ir_change_size } from "../../compiler/ir/looks/change_size";
import { ir_get_size } from "../../compiler/ir/looks/get_size";
import { ir_set_size } from "../../compiler/ir/looks/set_size";
import { CatnipInputOp, CatnipInputOpType, CatnipCommandOpType, CatnipOp } from "../CatnipOp";

type set_size_inputs = { size: CatnipInputOp };
type change_size_inputs = { change: CatnipInputOp };

export const op_set_size = new class extends CatnipCommandOpType<set_size_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: set_size_inputs): IterableIterator<CatnipOp> {
        yield inputs.size;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: set_size_inputs): void {
        ctx.emitInput(inputs.size, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_set_size, {}, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

export const op_change_size = new class extends CatnipCommandOpType<change_size_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: change_size_inputs): IterableIterator<CatnipOp> {
        yield inputs.change;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: change_size_inputs): void {
        ctx.emitInput(inputs.change, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_change_size, {}, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

export const op_get_size = new class extends CatnipInputOpType<{}> {
    public *getInputsAndSubstacks(): IterableIterator<CatnipOp> {}

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: {}): void {
        ctx.emitIr(ir_get_size, {}, {});
    }
}

// Scratch's stretch blocks are legacy no-ops (scratch3_looks.js registers
// them as `() => {}`); the opcodes still have to exist so projects load.
export const op_stretch_noop = new class extends CatnipCommandOpType<change_size_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: change_size_inputs): IterableIterator<CatnipOp> {
        yield inputs.change;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: change_size_inputs): void {
        // The input still has to be evaluated (it may have side effects).
        ctx.emitInput(inputs.change, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

registerSB3CommandBlock("looks_setsizeto", (ctx, block) => op_set_size.create({
    size: ctx.readInput(block.inputs.SIZE),
}));
registerSB3CommandBlock("looks_changesizeby", (ctx, block) => op_change_size.create({
    change: ctx.readInput(block.inputs.CHANGE),
}));
registerSB3InputBlock("looks_size", () => op_get_size.create({}));
registerSB3CommandBlock("looks_changestretchby", (ctx, block) => op_stretch_noop.create({
    change: ctx.readInput(block.inputs.CHANGE),
}));
registerSB3CommandBlock("looks_setstretchto", (ctx, block) => op_stretch_noop.create({
    change: ctx.readInput(block.inputs.STRETCH),
}));
