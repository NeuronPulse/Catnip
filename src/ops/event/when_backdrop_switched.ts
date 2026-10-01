import { CatnipIr } from "../../compiler/CatnipIr";
import { CatnipIrScriptTrigger } from "../../compiler/CatnipIrScriptTrigger";
import { ir_backdrop_switch_trigger } from "../../compiler/ir/event/backdrop_switch_trigger";
import { registerSB3HatBlock } from "../../sb3_ops";
import { CatnipScriptTriggerType } from "../CatnipScriptTrigger";

type when_backdrop_switched_inputs = { backdrop: string };

export const when_backdrop_switched_trigger = new class extends CatnipScriptTriggerType<when_backdrop_switched_inputs> {
    public createTriggerIR(ir: CatnipIr, inputs: when_backdrop_switched_inputs): CatnipIrScriptTrigger {
        return ir_backdrop_switch_trigger.create(ir, {
            name: inputs.backdrop,
            priority: 0
        })
    }
}

registerSB3HatBlock("event_whenbackdropswitchesto", (ctx, block) => when_backdrop_switched_trigger.create({
    backdrop: block.fields.BACKDROP[0] + ""
}));
