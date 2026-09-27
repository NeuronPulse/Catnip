import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipCommandOpType, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_ifonedgebounce } from "../../compiler/ir/motion/ifonedgebounce";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";

type if_on_edge_bounce_inputs = { };

export const op_if_on_edge_bounce = new class extends CatnipCommandOpType<if_on_edge_bounce_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: if_on_edge_bounce_inputs): IterableIterator<CatnipOp> { }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: if_on_edge_bounce_inputs): void {
        ctx.emitIr(ir_ifonedgebounce, {}, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

registerSB3CommandBlock("motion_ifonedgebounce", () => op_if_on_edge_bounce.create({}));
