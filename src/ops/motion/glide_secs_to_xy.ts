import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_glide_begin } from "../../compiler/ir/motion/glide_begin";
import { ir_glide_step } from "../../compiler/ir/motion/glide_step";
import { ir_cmp_gt } from "../../compiler/ir/operators/cmp_gt";
import { ir_yield } from "../../compiler/ir/core/yield";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";
import { CatnipWasmEnumThreadStatus } from "../../wasm-interop/CatnipWasmEnumThreadStatus";

type glide_secs_to_xy_inputs = { x: CatnipInputOp, y: CatnipInputOp, secs: CatnipInputOp };

export const op_glide_secs_to_xy = new class extends CatnipCommandOpType<glide_secs_to_xy_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: glide_secs_to_xy_inputs): IterableIterator<CatnipOp> {
        yield inputs.x;
        yield inputs.y;
        yield inputs.secs;
    }

    public isYielding(ir: CatnipIr, inputs: glide_secs_to_xy_inputs): boolean {
        return true;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: glide_secs_to_xy_inputs): void {
        ctx.emitInput(inputs.x, CatnipValueFormat.F64_NUMBER);
        ctx.emitInput(inputs.y, CatnipValueFormat.F64_NUMBER);
        ctx.emitInput(inputs.secs, CatnipValueFormat.F64_NUMBER);
        ctx.emitIr(ir_glide_begin, { mode: "xy" }, {});

        const loopBranch = ctx.emitBranch((block) => {
            ctx.emitIr(ir_glide_step, {}, {});
            ctx.emitIrConst(0, CatnipValueFormat.F64_NUMBER);
            ctx.emitIr(ir_cmp_gt, {}, {});
            ctx.emitConditionalJump(block, CatnipWasmEnumThreadStatus.YIELD);
        });

        ctx.emitIr(ir_request_redraw, {}, {});
        ctx.emitIr(ir_yield, { status: CatnipWasmEnumThreadStatus.YIELD }, { branch: loopBranch });
    }
}

registerSB3CommandBlock("motion_glidesecstoxy", (ctx, block) => op_glide_secs_to_xy.create({
    x: ctx.readInput(block.inputs.X),
    y: ctx.readInput(block.inputs.Y),
    secs: ctx.readInput(block.inputs.SECS),
}));
