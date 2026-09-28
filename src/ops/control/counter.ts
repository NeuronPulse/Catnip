import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipCommandOpType, CatnipInputOpType, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock, registerSB3InputBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_control_get_counter, ir_control_incr_counter, ir_control_clear_counter } from "../../compiler/ir/control/counter";

export const op_get_counter = new class extends CatnipInputOpType<{}> {
    public *getInputsAndSubstacks(): IterableIterator<CatnipOp> { }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: {}): void {
        ctx.emitIr(ir_control_get_counter, {}, {});
    }
}

export const op_incr_counter = new class extends CatnipCommandOpType<{}> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: {}): IterableIterator<CatnipOp> { }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: {}): void {
        ctx.emitIr(ir_control_incr_counter, {}, {});
    }
}

export const op_clear_counter = new class extends CatnipCommandOpType<{}> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: {}): IterableIterator<CatnipOp> { }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: {}): void {
        ctx.emitIr(ir_control_clear_counter, {}, {});
    }
}

registerSB3InputBlock("control_get_counter", (ctx, block) => op_get_counter.create({}));
registerSB3CommandBlock("control_incr_counter", (ctx, block) => op_incr_counter.create({}));
registerSB3CommandBlock("control_clear_counter", (ctx, block) => op_clear_counter.create({}));
