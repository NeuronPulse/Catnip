import { CatnipIr } from "../../compiler/CatnipIr";
import { CatnipIrScriptTrigger } from "../../compiler/CatnipIrScriptTrigger";
import { ir_click_trigger } from "../../compiler/ir/event/click_trigger";
import { registerSB3HatBlock } from "../../sb3_ops";
import { CatnipScriptTriggerType } from "../CatnipScriptTrigger";

// scratch-vm's two click opcodes are label-only variants of the same hat
// (mouse._activateClickHats starts both on the picked target, without
// checking isStage), so they share one trigger type here as well. Which
// sprite listens comes from the IR's spriteID, not from the opcode.
export const when_clicked_trigger = new class extends CatnipScriptTriggerType<{}> {
    public createTriggerIR(ir: CatnipIr): CatnipIrScriptTrigger {
        return ir_click_trigger.create(ir, {
            priority: 0
        })
    }
}

registerSB3HatBlock("event_whenthisspriteclicked", (ctx, block) => when_clicked_trigger.create({}));
registerSB3HatBlock("event_whenstageclicked", (ctx, block) => when_clicked_trigger.create({}));
