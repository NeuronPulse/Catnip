import { CatnipValueFormat } from "../../CatnipValueFormat";
import { CatnipInputOp } from "../../../ops";
import { CatnipCompilerIrGenContext } from "../../CatnipCompilerIrGenContext";
import { CatnipIr } from "../../CatnipIr";
import { CatnipIrScriptTrigger, CatnipIrScriptTriggerType } from "../../CatnipIrScriptTrigger";
import { CatnipCompilerGreaterThanSubsystem } from "../../subsystems/CatnipCompilerGreaterThanSubsystem";
import { ir_thread_terminate } from "../core/thread_terminate";
import { ir_whengreaterthan_poll } from "./whengreaterthan_poll";


export type ir_whengreaterthan_trigger_inputs = {
    readonly option: string;
    readonly value: CatnipInputOp;
    readonly key: number;
};

export const ir_whengreaterthan_trigger = new class extends CatnipIrScriptTriggerType<ir_whengreaterthan_trigger_inputs> {

    public create(ir: CatnipIr, inputs: ir_whengreaterthan_trigger_inputs): CatnipIrScriptTrigger<ir_whengreaterthan_trigger_inputs, this> {
        const trigger = super.create(ir, inputs);
        ir.compiler.getSubsystem(CatnipCompilerGreaterThanSubsystem).registerTrigger(trigger);
        return trigger;
    }

    public requiresFunctionIndex(): boolean {
        return true;
    }

    public preIR(ctx: CatnipCompilerIrGenContext, inputs: ir_whengreaterthan_trigger_inputs): void {
        // The loudness half of the hat needs the audio engine; catnip has no
        // microphone input yet, and scratch's predicate is falsy without one
        // ("audioEngine && audioEngine.getLoudness() > value"), so those hats
        // never fire — emit nothing, as an unknown option would.
        if (inputs.option !== "timer") return;

        // The threshold rides into the poll as its operand; the current timer
        // value is read inside the poll, in the hat thread's own context.
        ctx.emitInput(inputs.value, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_whengreaterthan_poll, { key: inputs.key }, {});
    }

    public postIR(ctx: CatnipCompilerIrGenContext, inputs: ir_whengreaterthan_trigger_inputs): void {
        ctx.emitIr(ir_thread_terminate, {}, {});
    }
}

export type CatnipIrScriptGreaterThanTrigger = CatnipIrScriptTrigger<ir_whengreaterthan_trigger_inputs, typeof ir_whengreaterthan_trigger>;
