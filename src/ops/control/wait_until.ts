import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../CatnipOp";
import { registerSB3CommandBlock } from "../../sb3_ops";
import { CatnipIr } from "../../compiler/CatnipIr";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { ir_branch } from "../../compiler/ir/core/branch";
import { ir_not } from "../../compiler/ir/operators/not";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";
import { CatnipWasmEnumThreadStatus } from "../../wasm-interop/CatnipWasmEnumThreadStatus";

type wait_until_inputs = { condition: CatnipInputOp };

export const op_wait_until = new class extends CatnipCommandOpType<wait_until_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: wait_until_inputs): IterableIterator<CatnipOp> {
        yield inputs.condition;
    }

    public isYielding(ir: CatnipIr, inputs: wait_until_inputs): boolean {
        return true;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: wait_until_inputs): void {
        // scratch-vm waitUntil: the condition is checked immediately, and while
        // it is false the block re-executes every frame. The check runs inline
        // on the first pass (ir_branch below); a false condition yields with
        // this same block as the resume point, so the dispatcher re-enters it
        // next tick. Falling out of the branch the condition finally held.
        const loopBranch = ctx.emitBranch((block) => {
            ctx.emitIr(ir_request_redraw, {}, {});
            ctx.emitInput(inputs.condition, CatnipValueFormat.I32_BOOLEAN);
            ctx.emitIr(ir_not, {}, {});
            ctx.emitConditionalJump(block, CatnipWasmEnumThreadStatus.YIELD);
        });

        ctx.emitIr(ir_branch, {}, { branch: loopBranch });
    }
}

registerSB3CommandBlock("control_wait_until", (ctx, block) =>
    op_wait_until.create({
        condition: ctx.readInput(block.inputs.CONDITION),
    })
);
