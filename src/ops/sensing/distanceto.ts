import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { ir_sensing_distanceto } from "../../compiler/ir/sensing/distanceto";
import { registerSB3InputBlock } from "../../sb3_ops";
import { CatnipInputOp, CatnipInputOpType, CatnipOp } from "../CatnipOp";

type distanceto_inputs = { option: CatnipInputOp };

export const op_distanceto = new class extends CatnipInputOpType<distanceto_inputs> {

    public *getInputsAndSubstacks(ir: unknown, inputs: distanceto_inputs): IterableIterator<CatnipOp> {
        yield inputs.option;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: distanceto_inputs): void {
        ctx.emitInput(inputs.option, CatnipValueFormat.I32_HSTRING);
        ctx.emitIr(ir_sensing_distanceto, {}, {});
    }
}

registerSB3InputBlock("sensing_distanceto", (ctx, block) =>
    op_distanceto.create({
        option: ctx.readInput(block.inputs.DISTANCETOMENU),
    })
);
