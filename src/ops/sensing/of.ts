import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { ir_sensing_of } from "../../compiler/ir/sensing/of";
import { registerSB3InputBlock } from "../../sb3_ops";
import { CatnipInputOp, CatnipInputOpType, CatnipOp } from "../CatnipOp";
import { op_const } from "../core/const";

type of_inputs = { object: CatnipInputOp, property: CatnipInputOp };

export const op_of = new class extends CatnipInputOpType<of_inputs> {

    public *getInputsAndSubstacks(ir: unknown, inputs: of_inputs): IterableIterator<CatnipOp> {
        yield inputs.object;
        yield inputs.property;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: of_inputs): void {
        // Operand order: object, then property — the pushed current target
        // follows both as the C function's last argument.
        ctx.emitInput(inputs.object, CatnipValueFormat.I32_HSTRING);
        ctx.emitInput(inputs.property, CatnipValueFormat.I32_HSTRING);
        ctx.emitIr(ir_sensing_of, {}, {});
    }
}

// The property is a dropdown (or a variable's name), never a reporter:
// a plain constant input, like the menu shadows.
registerSB3InputBlock("sensing_of", (ctx, block) =>
    op_of.create({
        object: ctx.readInput(block.inputs.OBJECT),
        property: op_const.create({ value: block.fields.PROPERTY[0] }),
    })
);
