import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { ir_sensing_set_drag_mode } from "../../compiler/ir/sensing/set_drag_mode";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";
import { op_const } from "../core/const";

type set_drag_mode_inputs = { mode: CatnipInputOp };

export const op_set_drag_mode = new class extends CatnipCommandOpType<set_drag_mode_inputs> {

    public *getInputsAndSubstacks(ir: unknown, inputs: set_drag_mode_inputs): IterableIterator<CatnipOp> {
        yield inputs.mode;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: set_drag_mode_inputs): void {
        ctx.emitInput(inputs.mode, CatnipValueFormat.F64);
        ctx.emitIr(ir_sensing_set_drag_mode, {}, {});
    }
}

registerSB3CommandBlock("sensing_setdragmode", (ctx, block) =>
    op_set_drag_mode.create({
        mode: op_const.create({ value: block.fields.DRAG_MODE[0] === "draggable" ? 1 : 0 }),
    })
);
