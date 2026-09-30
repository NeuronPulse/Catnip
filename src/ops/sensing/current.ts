import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { registerSB3InputBlock } from "../../sb3_ops";
import { CatnipInputOpType, CatnipOp } from "../CatnipOp";

type current_inputs = { menu: "year" | "month" | "date" | "dayofweek" | "hour" | "minute" | "second" };

export const op_current = new class extends CatnipInputOpType<current_inputs> {

    public *getInputsAndSubstacks(): IterableIterator<CatnipOp> { }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: current_inputs): void {
        // scratch-vm `current()`: local-time Date getters, month and weekday
        // one-based, the block's field compared lower-cased.
        ctx.emitCallback("sensing current", () => {
            const date = new Date();
            switch (inputs.menu) {
                case "year": return date.getFullYear();
                case "month": return date.getMonth() + 1;
                case "date": return date.getDate();
                case "dayofweek": return date.getDay() + 1;
                case "hour": return date.getHours();
                case "minute": return date.getMinutes();
                case "second": return date.getSeconds();
            }
            return 0;
        }, [], CatnipValueFormat.F64);
    }
}

registerSB3InputBlock("sensing_current", (ctx, block) => op_current.create({
    menu: block.fields.CURRENTMENU[0].toLowerCase() as current_inputs["menu"]
}));
