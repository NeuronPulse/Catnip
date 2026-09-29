import { CatnipIr } from "../../compiler/CatnipIr";
import { CatnipIrScriptTrigger } from "../../compiler/CatnipIrScriptTrigger";
import { ir_whengreaterthan_trigger } from "../../compiler/ir/event/greaterthan_trigger";
import { CatnipCompilerGreaterThanSubsystem } from "../../compiler/subsystems/CatnipCompilerGreaterThanSubsystem";
import { registerSB3HatBlock } from "../../sb3_ops";
import { CatnipInputOp } from "../CatnipOp";
import { CatnipScriptTriggerType } from "../CatnipScriptTrigger";

type when_greater_than_inputs = { option: string; value: CatnipInputOp };

export const when_greater_than_trigger = new class extends CatnipScriptTriggerType<when_greater_than_inputs> {

    public createTriggerIR(ir: CatnipIr, inputs: when_greater_than_inputs): CatnipIrScriptTrigger {
        const subsystem = ir.compiler.getSubsystem(CatnipCompilerGreaterThanSubsystem);
        return ir_whengreaterthan_trigger.create(ir, {
            option: inputs.option,
            value: inputs.value,
            key: subsystem.allocateKey(),
        });
    }
}

registerSB3HatBlock("event_whengreaterthan", (ctx, block) => when_greater_than_trigger.create({
    option: ("" + block.fields.WHENGREATERTHANMENU[0]).toLowerCase(),
    value: ctx.readInput(block.inputs.VALUE),
}));
