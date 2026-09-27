import { CatnipEventID } from "../../CatnipEvents";
import { CatnipCompiler } from "../CatnipCompiler";
import { CatnipCompilerSubsystem } from "../CatnipCompilerSubsystem";
import { CatnipIrScriptEventTrigger } from "../ir/core/event_trigger";
import { CatnipTriggerFunctionGenerator, CATNIP_THREAD_START_RESTART } from "../CatnipTriggerGenerator";

export class CatnipCompilerEventTriggerSubsystem extends CatnipCompilerSubsystem {
    private readonly _triggers: Map<CatnipEventID, CatnipTriggerFunctionGenerator>;

    public constructor(compiler: CatnipCompiler) {
        super(compiler);
        this._triggers = new Map();
    }

    public addTrigger(trigger: CatnipIrScriptEventTrigger) {
        let eventInfo = this._triggers.get(trigger.inputs.id);

        if (eventInfo === undefined) {
            // Every event hat Catnip implements restarts its thread when the
            // event fires again (flag clicked, sprite clicked, ...), the way
            // scratch-vm's getHats declares them.
            eventInfo = new CatnipTriggerFunctionGenerator(this.compiler, false, CATNIP_THREAD_START_RESTART);
            this._triggers.set(trigger.inputs.id, eventInfo);
        }

        eventInfo.addTrigger(trigger);
    }

    public addEvents(): void {
        for (const [eventID, eventInfo] of this._triggers)
            this.compiler.addEventListener(eventID, eventInfo.createEventFunction());
    }
}