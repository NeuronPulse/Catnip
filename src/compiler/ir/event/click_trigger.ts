import { CatnipCompilerIrGenContext } from "../../CatnipCompilerIrGenContext";
import { CatnipIr } from "../../CatnipIr";
import { CatnipIrScriptTrigger, CatnipIrScriptTriggerType } from "../../CatnipIrScriptTrigger";
import { CatnipCompilerClickTriggerSubsystem } from "../../subsystems/CatnipCompilerClickTriggerSubsystem";
import { ir_thread_terminate } from "../core/thread_terminate";

export type ir_click_trigger_inputs = {
    readonly priority: number;
};

export const ir_click_trigger = new class extends CatnipIrScriptTriggerType<ir_click_trigger_inputs> {
    public create(ir: CatnipIr, inputs: ir_click_trigger_inputs): CatnipIrScriptTrigger<ir_click_trigger_inputs, this> {
        const trigger = super.create(ir, inputs);
        ir.compiler.getSubsystem(CatnipCompilerClickTriggerSubsystem).addTrigger(trigger);
        return trigger;
    }

    public requiresFunctionIndex(): boolean {
        return true;
    }

    public postIR(ctx: CatnipCompilerIrGenContext, inputs: ir_click_trigger_inputs): void {
        ctx.emitIr(ir_thread_terminate, {}, {});
    }
};

export type CatnipIrScriptClickTrigger = CatnipIrScriptTrigger<ir_click_trigger_inputs, typeof ir_click_trigger>;
