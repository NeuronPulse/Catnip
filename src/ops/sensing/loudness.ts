import { CatnipValueFormat } from "../../compiler/CatnipValueFormat";
import { registerSB3InputBlock } from "../../sb3_ops";
import { op_const } from "../core/const";

// scratch-vm's primitive is a legacy no-op that returns undefined
// (`sensing_userid: () => {}`), so the block reads as the empty string —
// Scratch has no user ids anymore.
registerSB3InputBlock("sensing_userid", () => op_const.create({
    value: ""
}));

// scratch-vm's `getLoudness()` answers -1 while `runtime.audioEngine` is
// undefined; catnip has no audio engine (same reasoning as the loudness edge
// hat in M4c), so the meter can only ever read -1.
registerSB3InputBlock("sensing_loudness", () => op_const.create({
    value: -1
}));
