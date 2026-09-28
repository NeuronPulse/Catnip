import { CatnipCompilerWasmGenContext } from "../../CatnipCompilerWasmGenContext";
import { CatnipIrCommandOpType, CatnipIrOp } from "../../CatnipIrOp";
import { CatnipValueFormat } from "../../CatnipValueFormat";
import { ir_convert } from "../core/convert";

export type backdrop_set_ir_inputs = { };

export const ir_backdrop_set = new class extends CatnipIrCommandOpType<backdrop_set_ir_inputs> {
    public constructor() { super("looks_backdrop_set"); }

    public getOperandCount(): number { return 1; }

    public generateWasm(ctx: CatnipCompilerWasmGenContext, ir: CatnipIrOp<backdrop_set_ir_inputs, {}>): void {
        // Backdrop names and numeric strings both go through the string path
        // of catnip_blockutil_costume_set (numbers parse as indices there).
        ir_convert.emitConversion(ctx, ir.operands[0].format, CatnipValueFormat.I32_HSTRING);
        ctx.emitWasmGetRuntime();
        ctx.emitWasmRuntimeFunctionCall("catnip_looks_backdrop_set");
    }
}
