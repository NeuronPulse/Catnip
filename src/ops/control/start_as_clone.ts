import { CatnipIr } from "../../compiler/CatnipIr";
import { CatnipIrScriptTrigger } from "../../compiler/CatnipIrScriptTrigger";
import { ir_clone_trigger } from "../../compiler/ir/event/clone_trigger";
import { registerSB3HatBlock } from "../../sb3_ops";
import { CatnipScriptTriggerType } from "../CatnipScriptTrigger";

// scratch-vm starts this hat from RenderedTarget.initDrawable
// (runtime.startHats('control_start_as_clone', null, this)), so it fires on
// the fresh clone alone, with getHats' restartExistingThreads: false — the
// ALWAYS start mode — and the new target arrives as the trigger's argument.
export const when_start_as_clone_trigger = new class extends CatnipScriptTriggerType<{}> {
    public createTriggerIR(ir: CatnipIr): CatnipIrScriptTrigger {
        return ir_clone_trigger.create(ir, {
            priority: 0
        });
    }
}

registerSB3HatBlock("control_start_as_clone", (ctx, block) => when_start_as_clone_trigger.create({}));
