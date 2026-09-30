import { CatnipCompilerValue } from "../../CatnipCompilerValue";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrInputOp, CatnipIrInputOpType, CatnipIrOp } from "../../CatnipIrOp";
import { CatnipValueFormat } from "../../CatnipValueFormat";

/**
 * ask and wait: enqueues the question for the host UI and returns the
 * asker's ticket. The pushed current target is the second argument — the
 * queue remembers who asked for the say bubble.
 */
export const ir_sensing_ask = new class extends CatnipIrInputOpType<{}> {
    public constructor() { super("sensing_ask"); }

    public getOperandCount(): number { return 1; }

    public getResult(): CatnipCompilerValue {
        return CatnipCompilerValue.dynamic(CatnipValueFormat.I32_NUMBER);
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrInputOp<{}>): void {
        ctx.emitWasmGetCurrentTarget();
        ctx.emitWasmRuntimeFunctionCall("catnip_sensing_ask");
    }
}

/** Whether the question with this ticket has been answered yet. */
export const ir_sensing_ask_done = new class extends CatnipIrInputOpType<{}> {
    public constructor() { super("sensing_ask_done"); }

    public getOperandCount(): number { return 1; }

    public getResult(): CatnipCompilerValue {
        return CatnipCompilerValue.dynamic(CatnipValueFormat.I32_BOOLEAN);
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrInputOp<{}>): void {
        ctx.emitWasmRuntimeFunctionCall("catnip_sensing_ask_done");
    }
}

/** The most recent answer, "" before anyone answered. */
export const ir_sensing_answer_get = new class extends CatnipIrInputOpType<{}> {
    public constructor() { super("sensing_answer_get"); }

    public getOperandCount(): number { return 0; }

    public getResult(): CatnipCompilerValue {
        return CatnipCompilerValue.dynamic(CatnipValueFormat.I32_HSTRING);
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrInputOp<{}>): void {
        ctx.emitWasmRuntimeFunctionCall("catnip_sensing_answer_get");
    }
}
