import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_next_costume } from "../../compiler/ir/looks/next_costume";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";
import { CatnipCommandOpType, CatnipOp } from "../CatnipOp";

type next_costume_inputs = {};

export const op_next_costume = new class extends CatnipCommandOpType<next_costume_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: next_costume_inputs): IterableIterator<CatnipOp> {}

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: next_costume_inputs): void {
        ctx.emitIr(ir_next_costume, {}, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

registerSB3CommandBlock("looks_nextcostume", () => op_next_costume.create({}));
