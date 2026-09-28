import { SpiderNumberType, SpiderOpcodes } from "wasm-spider";
import { CatnipCompilerValue } from "../../CatnipCompilerValue";
import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrInputOp, CatnipIrInputOpType, CatnipIrOp } from "../../CatnipIrOp";
import { CatnipValueFormat } from "../../CatnipValueFormat";
import { CatnipWasmStructRuntime } from "../../../wasm-interop/CatnipWasmStructRuntime";

export const ir_control_get_counter = new class extends CatnipIrInputOpType<{}> {
    public constructor() { super("control_get_counter"); }

    public getOperandCount(): number {
        return 0;
    }

    public getResult(ir: CatnipIrOp): CatnipCompilerValue {
        return CatnipCompilerValue.dynamic(CatnipValueFormat.F64_NUMBER);
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrInputOp<{}>): void {
        ctx.emitWasmGetRuntime();
        ctx.emitWasm(SpiderOpcodes.f64_load, 3, CatnipWasmStructRuntime.getMemberOffset("counter"));
    }
}

export const ir_control_incr_counter = new class extends CatnipIrCommandOpType<{}> {
    public constructor() { super("control_incr_counter"); }

    public getOperandCount(): number {
        return 0;
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrInputOp<{}>): void {
        // runtime->counter += 1
        ctx.emitWasmGetRuntime();
        ctx.emitWasmGetRuntime();
        ctx.emitWasm(SpiderOpcodes.f64_load, 3, CatnipWasmStructRuntime.getMemberOffset("counter"));
        ctx.emitWasmConst(SpiderNumberType.f64, 1);
        ctx.emitWasm(SpiderOpcodes.f64_add);
        ctx.emitWasm(SpiderOpcodes.f64_store, 3, CatnipWasmStructRuntime.getMemberOffset("counter"));
    }
}

export const ir_control_clear_counter = new class extends CatnipIrCommandOpType<{}> {
    public constructor() { super("control_clear_counter"); }

    public getOperandCount(): number {
        return 0;
    }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrInputOp<{}>): void {
        // runtime->counter = 0
        ctx.emitWasmGetRuntime();
        ctx.emitWasmConst(SpiderNumberType.f64, 0);
        ctx.emitWasm(SpiderOpcodes.f64_store, 3, CatnipWasmStructRuntime.getMemberOffset("counter"));
    }
}
