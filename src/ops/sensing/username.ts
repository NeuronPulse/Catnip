import { CatnipCompilerIrGenContext } from "../../compiler/CatnipCompilerIrGenContext";
import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { registerSB3InputBlock } from "../../sb3_ops";
import { CatnipInputOpType, CatnipOp } from "../CatnipOp";
import { getPlayerName } from "./player_name";

type username_inputs = {};

export const op_username = new class extends CatnipInputOpType<username_inputs> {

    public *getInputsAndSubstacks(): IterableIterator<CatnipOp> { }

    public generateIr(ctx: CatnipCompilerIrGenContext, inputs: username_inputs): void {
        // scratch-vm `getUsername()` reads the userData io device; without a
        // host login that is the empty string, which is what a standalone run
        // of Scratch itself reports.
        ctx.emitCallback("sensing username", getPlayerName, [], CatnipValueFormat.I32_HSTRING);
    }
}

registerSB3InputBlock("sensing_username", () => op_username.create({}));
