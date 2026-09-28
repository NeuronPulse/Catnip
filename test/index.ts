
import { run } from "../src/index";
import fs from "node:fs/promises";
import { registerSB3CommandBlock, sb3_ops } from "../src/sb3_ops";
import { CatnipCommandList, CatnipCommandOpType, CatnipInputOp, CatnipOp } from "../src/ops/CatnipOp";
import { CatnipIr } from "../src/compiler/CatnipIr";
import { op_log } from "../src/ops/core/log";
import { op_const } from "../src/ops/core/const";
import { op_callback_command } from '../src/ops/core/callback_command';
import { CatnipValueFormat } from "../src/compiler/CatnipValueFormat";
import { CatnipEventID } from "../src/CatnipEvents";
import { CatnipProjectModule } from "../src/runtime/CatnipProjectModule";
import { DRAW_STATE, DRAW_STATE_STRIDE } from "../src/runtime/ICatnipRenderer";
import { test } from "tap"



// The production `say` deserializer, captured once: the harness wraps it
// (real bubble write first, then the protocol parse of the same text)
// instead of replacing it, because fixtures assert bubbles through the
// protocol while their own `say` blocks must keep producing real ones.
const productionSay = sb3_ops.commandBlocks.get("looks_say")!;
const op_say_and_report = new class extends CatnipCommandOpType<{ commands: CatnipCommandList }> {
    public *getInputsAndSubstacks(ir: CatnipIr, inputs: { commands: CatnipCommandList }): IterableIterator<CatnipOp> {
        for (const command of inputs.commands) yield command;
    }

    public generateIr(ctx: any, inputs: { commands: CatnipCommandList }): void {
        ctx.emitCommands(inputs.commands);
    }
};

async function main() {

    const catnipWasmFile = await fs.readFile("public/catnip.wasm");
    const catnipModule = await WebAssembly.compile(catnipWasmFile);

    for (const projectFileName of (await fs.readdir("test/execute"))) {

        if (projectFileName.endsWith(".sb2"))
            throw new Error("SB2 not supported.");

        if (!projectFileName.endsWith(".sb3"))
            continue;

        const projectFile = await fs.readFile("test/execute/" + projectFileName);

        test(`${projectFileName}`, async t => {

            let didPlan = false;
            let didEnd = false;
            // Assigned once compiled; protocol words that read live state
            // (like "draw") look at it while the project is stepping.
            let projectModule: CatnipProjectModule | null = null;
            // A project that stops its own threads ("stop all") has nothing
            // left to say "end" with, so it says this instead and the run ends
            // when the last thread does.
            let expectStopped = false;
            // Key events a "keydown"/"keyup" say asked for, sent between steps:
            // a project cannot re-enter its own runtime from inside a step.
            const pendingEvents: [CatnipEventID, number][] = [];

            registerSB3CommandBlock("looks_say", (ctx, block) =>
                op_say_and_report.create({
                    commands: [
                        productionSay(ctx, block),
                        op_callback_command.create({
                    name: "test_callback",
                    inputs: [[ctx.readInput(block.inputs.MESSAGE), CatnipValueFormat.I32_HSTRING]],
                    callback: (message) => {

                        const command = message.split(/\s+/, 1)[0].toLowerCase();
                        const arg = message.substring(command.length).trim();

                        switch (command) {
                            case "pass":
                                t.pass(arg);
                                break;
                            case "fail":
                                t.fail(arg);
                                break;
                            case "plan":
                                if (didPlan) {
                                    t.fail("Must plan only once.")
                                } else {
                                    didPlan = true;
                                    t.plan(Number(arg));
                                }
                                break;
                            case "end":
                                didEnd = true;
                                // ??
                                t.end();
                                break;
                            case "expectstop":
                                expectStopped = true;
                                break;
                            case "keydown":
                            case "keyup":
                                pendingEvents.push([
                                    command === "keydown" ? "IO_KEY_PRESSED" : "IO_KEY_RELEASED",
                                    Number(arg)
                                ]);
                                break;
                            // "click N" clicks target N (0 = stage, sprites
                            // follow in project order); the index becomes the
                            // target's pointer when the event is flushed.
                            case "click":
                                pendingEvents.push(["IO_CLICK_TARGET", Number(arg)]);
                                break;
                            // "draw <target> <field> <value>" asserts the
                            // live draw state (the same packing frame() sends
                            // to the renderer), so visual blocks like size,
                            // effects and visibility are checkable headless.
                            case "draw": {
                                const parts = arg.split(/\s+/);
                                const targetIndex = Number(parts[0]);
                                const field = (DRAW_STATE as Record<string, number>)[parts[1]];
                                const expected = Number(parts[2]);
                                if (projectModule === null || parts.length !== 3
                                    || Number.isNaN(targetIndex) || field === undefined
                                    || Number.isNaN(expected)) {
                                    t.fail(`Bad draw protocol word: ${message}`);
                                    break;
                                }
                                const actual = projectModule.getDrawState()[targetIndex * DRAW_STATE_STRIDE + field];
                                if (Math.abs(actual - expected) < 1e-6)
                                    t.pass(message);
                                else
                                    t.fail(`${message}: expected ${expected}, got ${actual}`);
                                break;
                            }
                            // "layer A B" asserts that target A is in front
                            // of target B (higher layer rank; 0 = stage,
                            // sprites follow in project order).
                            case "layer": {
                                const parts = arg.split(/\s+/);
                                const front = Number(parts[0]);
                                const behind = Number(parts[1]);
                                if (projectModule === null || parts.length !== 2
                                    || Number.isNaN(front) || Number.isNaN(behind)) {
                                    t.fail(`Bad layer protocol word: ${message}`);
                                    break;
                                }
                                const ranks = projectModule.getLayers();
                                if (ranks[front] > ranks[behind])
                                    t.pass(message);
                                else
                                    t.fail(`${message}: rank ${ranks[front]} <= ${ranks[behind]}`);
                                break;
                            }
                            // "bubble <target> <say|think|none> [text]"
                            // asserts a target's live say/think bubble.
                            case "bubble": {
                                const marker = arg.search(/\s/);
                                const targetIndex = Number(arg.substring(0, marker < 0 ? arg.length : marker));
                                const rest = marker < 0 ? "" : arg.substring(marker + 1);
                                const spaceAt = rest.search(/\s/);
                                const kind = spaceAt < 0 ? rest : rest.substring(0, spaceAt);
                                const text = spaceAt < 0 ? "" : rest.substring(spaceAt + 1);
                                if (projectModule === null || Number.isNaN(targetIndex)
                                    || !["say", "think", "none"].includes(kind)
                                    || (kind !== "none" && text === "")) {
                                    t.fail(`Bad bubble protocol word: ${message}`);
                                    break;
                                }
                                const bubble = projectModule.getBubble(targetIndex);
                                const expectedType = kind === "say" ? 1 : kind === "think" ? 2 : 0;
                                const expectedText = kind === "none" ? "" : text;
                                if (bubble.type === expectedType && bubble.text === expectedText)
                                    t.pass(message);
                                else
                                    t.fail(`${message}: expected ${expectedType} "${expectedText}", got ${bubble.type} "${bubble.text}"`);
                                break;
                            }
                            case "comment":
                                t.comment(message);
                                break;
                            default:
                                t.comment(message);
                                break;
                        }
                    }
                }),
                    ],
                }), true);

            const project = await run(catnipModule, projectFile);
            projectModule = await project.compile({
                // Binaryen takes a long time, we don't need it for the tests
                enable_optimization_binaryen: false,
                // Force variable inlining for tests, to thoughly test it
                enable_optimization_variable_inlining_force: true,                
            });

            projectModule.start();

            do {
                while (pendingEvents.length !== 0) {
                    const [eventID, arg] = pendingEvents.shift()!;
                    if (eventID === "IO_CLICK_TARGET") {
                        let spriteIndex = 0;
                        for (const sprite of project.sprites) {
                            if (spriteIndex++ === arg) {
                                projectModule.triggerEvent("IO_CLICK_TARGET", sprite.defaultTarget.structWrapper.ptr);
                                break;
                            }
                        }
                    } else {
                        projectModule.triggerEvent(eventID, arg);
                    }
                }

                projectModule.step();
            } while (!didEnd && projectModule.hasRunningThreads());

            if (!didEnd) {
                if (expectStopped && !projectModule.hasRunningThreads()) return;

                t.fail("Test did not end.");
                t.end();
                return;
            }
        });
    }

    // const wasmFile = await fs.readFile("public/catnip.wasm");
    // const module = await WebAssembly.compile(wasmFile);


    // // const projectFile = await fs.readFile("public/Memory Corruption.sb3");
    // const projectFile = await fs.readFile("public/Mandlebrot Set Benchmark.sb3");
    // // const projectFile = await fs.readFile("public/Project.sb3");

    // run(module, projectFile);
}

main();