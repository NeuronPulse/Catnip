import { CatnipCompilerIrGenContext } from "../../CatnipCompilerIrGenContext";
import { CatnipIr } from "../../CatnipIr";
import { CatnipIrScriptTrigger, CatnipIrScriptTriggerType } from "../../CatnipIrScriptTrigger";
import { CatnipCompilerCloneTriggerSubsystem } from "../../subsystems/CatnipCompilerCloneTriggerSubsystem";
import { ir_thread_terminate } from "../core/thread_terminate";

export type ir_clone_trigger_inputs = {
    readonly priority: number;
};

export const ir_clone_trigger = new class extends CatnipIrScriptTriggerType<ir_clone_trigger_inputs> {
    public create(ir: CatnipIr, inputs: ir_clone_trigger_inputs): CatnipIrScriptTrigger<ir_clone_trigger_inputs, this> {
        const trigger = super.create(ir, inputs);
        ir.compiler.getSubsystem(CatnipCompilerCloneTriggerSubsystem).addTrigger(trigger);
        return trigger;
    }

    public requiresFunctionIndex(): boolean {
        return true;
    }

    public postIR(ctx: CatnipCompilerIrGenContext, inputs: ir_clone_trigger_inputs): void {
        ctx.emitIr(ir_thread_terminate, {}, {});
    }
};

export type CatnipIrScriptCloneTrigger = CatnipIrScriptTrigger<ir_clone_trigger_inputs, typeof ir_clone_trigger>;
