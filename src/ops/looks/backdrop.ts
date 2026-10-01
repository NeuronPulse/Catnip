import { registerSB3CommandBlock, registerSB3InputBlock } from "../../sb3_ops";
import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipCompilerLogger } from "../../compiler/CatnipCompilerLogger";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { CatnipIr } from "../../compiler/CatnipIr";
import { ir_backdrop_set } from "../../compiler/ir/looks/backdrop_set";
import { ir_branch } from "../../compiler/ir/core/branch";
import { ir_get_backdrop_name } from "../../compiler/ir/looks/get_backdrop_name";
import { ir_get_backdrop_number } from "../../compiler/ir/looks/get_backdrop_number";
import { ir_i32_cmp_eq } from "../../compiler/ir/operators/i32_cmp_eq";
import { ir_if_else } from "../../compiler/ir/control/if_else";
import { ir_next_backdrop } from "../../compiler/ir/looks/next_backdrop";
import { ir_request_redraw } from "../../compiler/ir/core/request_redraw";
import { ir_transient_load } from "../../compiler/ir/core/transient_load";
import { ir_transient_tee } from "../../compiler/ir/core/transient_tee";
import { ir_wait_for_threads } from "../../compiler/ir/core/wait_for_threads";
import { CatnipWasmEnumThreadStatus } from "../../wasm-interop/CatnipWasmEnumThreadStatus";
import { CatnipInputOp, CatnipInputOpType, CatnipCommandOpType, CatnipOp } from "../CatnipOp";

type backdrop_inputs = { backdrop: CatnipInputOp };

// The backdrop menu and the switch blocks always resolve against the stage,
// whatever script runs them. The value is unboxed to a string: names match
// directly and numeric strings fall through to the index path in
// catnip_blockutil_costume_set, like scratch's _setBackdrop.
export const op_switch_backdrop = new class extends CatnipCommandOpType<backdrop_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: backdrop_inputs): IterableIterator<CatnipOp> {
        yield inputs.backdrop;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: backdrop_inputs): void {
        // Requesting F64 keeps every lane in the 64-bit family, which
        // ir_backdrop_set can then turn into a string in one step.
        ctx.emitInput(inputs.backdrop, CatnipValueFormat.F64);
        ctx.emitIr(ir_backdrop_set, { threadListVariable: null }, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

type backdrop_and_wait_inputs = { backdrop: CatnipInputOp };

// scratch3_looks.switchBackdropAndWait: switch once, then keep yielding
// until every thread the switch started has left the runtime (an empty
// start list returns immediately, so a project without the hat cannot hang).
export const op_switch_backdrop_and_wait = new class extends CatnipCommandOpType<backdrop_and_wait_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: backdrop_and_wait_inputs): IterableIterator<CatnipOp> {
        yield inputs.backdrop;
    }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: backdrop_and_wait_inputs): void {
        ctx.emitInput(inputs.backdrop, CatnipValueFormat.F64);

        const threadListVariable = ctx.emitTransientCreate(CatnipValueFormat.I32_NUMBER, "Thread List");

        ctx.emitIr(ir_backdrop_set, { threadListVariable: threadListVariable }, {});
        ctx.emitIr(ir_request_redraw, {}, {});
        ctx.emitIr(
            ir_branch, {},
            {
                branch: ctx.emitBranch((loopHead) => {

                    const threadStatusVariable = ctx.emitTransientCreate(CatnipValueFormat.I32_NUMBER, "Thread Status");

                    ctx.emitIr(ir_transient_load, { transient: threadListVariable }, {});
                    ctx.emitIr(ir_wait_for_threads, {}, {});
                    ctx.emitIr(ir_transient_tee, { transient: threadStatusVariable }, {});

                    CatnipCompilerLogger.assert(CatnipWasmEnumThreadStatus.RUNNING === 0);

                    ctx.emitIr(ir_if_else, {}, {
                        true_branch: ctx.emitBranch(() => {
                            ctx.emitIr(ir_transient_load, { transient: threadStatusVariable }, {});
                            ctx.emitIrConst(CatnipWasmEnumThreadStatus.YIELD, CatnipValueFormat.I32_NUMBER);
                            ctx.emitIr(ir_i32_cmp_eq, {}, {});

                            ctx.emitIr(ir_if_else, {}, {
                                true_branch: ctx.emitBranch(() => ctx.emitJump(loopHead, CatnipWasmEnumThreadStatus.YIELD)),
                                false_branch: ctx.emitBranch(() => ctx.emitJump(loopHead, CatnipWasmEnumThreadStatus.YILED_TICK))
                            });

                        }),
                        false_branch: ctx.emitBranch(),
                    });
                })
            }
        )
    }
}

type next_backdrop_inputs = {};

export const op_next_backdrop = new class extends CatnipCommandOpType<next_backdrop_inputs> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: next_backdrop_inputs): IterableIterator<CatnipOp> {}

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: next_backdrop_inputs): void {
        ctx.emitIr(ir_next_backdrop, {}, {});
        ctx.emitIr(ir_request_redraw, {}, {});
    }
}

type backdrop_number_name_inputs = { type: "number" | "name" };

export const op_get_backdrop_number_name = new class extends CatnipInputOpType<backdrop_number_name_inputs> {
    public *getInputsAndSubstacks(): IterableIterator<CatnipOp> {}

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: backdrop_number_name_inputs): void {
        if (inputs.type === "number") {
            ctx.emitIr(ir_get_backdrop_number, {}, {});
        } else {
            ctx.emitIr(ir_get_backdrop_name, {}, {});
        }
    }
}

registerSB3CommandBlock("looks_switchbackdropto", (ctx, block) => op_switch_backdrop.create({
    backdrop: ctx.readInput(block.inputs.BACKDROP),
}));
registerSB3CommandBlock("looks_switchbackdroptoandwait", (ctx, block) => op_switch_backdrop_and_wait.create({
    backdrop: ctx.readInput(block.inputs.BACKDROP),
}));
registerSB3CommandBlock("looks_nextbackdrop", () => op_next_backdrop.create({}));
registerSB3InputBlock("looks_backdropnumbername", (ctx, block) => op_get_backdrop_number_name.create({
    type: block.fields.NUMBER_NAME[0]
}));
