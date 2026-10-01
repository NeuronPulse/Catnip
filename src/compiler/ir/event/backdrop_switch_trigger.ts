import { CatnipCompilerIrGenContext } from "../../CatnipCompilerIrGenContext";
import { CatnipIr } from "../../CatnipIr";
import { CatnipIrScriptTrigger, CatnipIrScriptTriggerType } from "../../CatnipIrScriptTrigger";
import { CatnipCompilerBackdropSubsystem } from "../../subsystems/CatnipCompilerBackdropSubsystem";
import { ir_thread_terminate } from "../core/thread_terminate";


export type ir_backdrop_switch_trigger_inputs = {
    readonly name: string;
    readonly priority: number;
};

export const ir_backdrop_switch_trigger = new class extends CatnipIrScriptTriggerType<ir_backdrop_switch_trigger_inputs> {

    public create(ir: CatnipIr, inputs: ir_backdrop_switch_trigger_inputs): CatnipIrScriptTrigger<ir_backdrop_switch_trigger_inputs, this> {
        const trigger = super.create(ir, inputs);
        ir.compiler.getSubsystem(CatnipCompilerBackdropSubsystem).registerBackdropSwitchTrigger(trigger);
        return trigger;
    }

    public requiresFunctionIndex(): boolean {
        return true;
    }

    public postIR(ctx: CatnipCompilerIrGenContext, inputs: ir_backdrop_switch_trigger_inputs): void {
        ctx.emitIr(ir_thread_terminate, {}, {});
    }
}

export type CatnipIrScriptBackdropSwitchTrigger = CatnipIrScriptTrigger<ir_backdrop_switch_trigger_inputs, typeof ir_backdrop_switch_trigger>;
