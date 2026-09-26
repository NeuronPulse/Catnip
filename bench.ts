import { run } from "./src/index";
import fs from "node:fs/promises";

// Headless benchmark: loads one .sb3, compiles it and steps it under a cap.
//
//   node --import ./ts-node.register.js ./bench.ts <path.sb3> [maxSteps] [maxMs]
//
// Environment knobs:
//   BENCH_BINARYEN=0      disable binaryen (default: on, matches the playground)
//   BENCH_INLINE_FORCE=1  force variable inlining (default: off)
//   BENCH_STEP_RATE=<hz>  simulation step rate (default: the runtime's default).
//                         A tiny rate makes the step budget effectively
//                         unbounded, so each step runs until the project yields;
//                         that measures raw throughput instead of frame time.
const projectPath = process.argv[2];
const maxSteps = Number(process.argv[3] ?? 5_000_000);
const maxMs = Number(process.argv[4] ?? 10_000);

if (!projectPath) {
    console.error("usage: node --import ./ts-node.register.js ./bench.ts <path.sb3> [maxSteps] [maxMs]");
    process.exit(1);
}

const useBinaryen = process.env.BENCH_BINARYEN !== "0";
const inlineForce = process.env.BENCH_INLINE_FORCE === "1";
const stepRate = process.env.BENCH_STEP_RATE === undefined ? undefined : Number(process.env.BENCH_STEP_RATE);

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
    return sorted[idx];
}

async function main() {
    const t0 = Date.now();
    const wasm = await WebAssembly.compile(await fs.readFile("public/catnip.wasm"));
    const project = await run(wasm, await fs.readFile(projectPath));
    const tLoad = Date.now() - t0;

    const t1 = Date.now();
    const mod = await project.compile({
        enable_optimization_binaryen: useBinaryen,
        enable_optimization_variable_inlining_force: inlineForce,
        dump_stage_timings: true,
    });
    const tCompile = Date.now() - t1;

    const t2 = Date.now();
    if (stepRate !== undefined) mod.setStepRate(stepRate);
    const started = mod.triggerEvent("PROJECT_START");
    console.log(`green-flag listener: ${started} | threads after start: ${mod.hasRunningThreads()}`);

    const stepTimes: number[] = [];
    let steps = 0;
    do {
        const stepStart = performance.now();
        mod.step();
        stepTimes.push(performance.now() - stepStart);
        steps++;
    } while (mod.hasRunningThreads() && steps < maxSteps && Date.now() - t2 < maxMs);

    stepTimes.sort((a, b) => a - b);
    const totalStepMs = Date.now() - t2;
    const avg = stepTimes.reduce((a, b) => a + b, 0) / (stepTimes.length || 1);

    console.log(`--- ${projectPath}`);
    console.log(`binaryen=${useBinaryen} inliningForce=${inlineForce} stepRate=${mod.stepRate}Hz`);
    console.log(`wasm+parse ${tLoad}ms | compile ${tCompile}ms | ${steps} steps in ${totalStepMs}ms | still running: ${mod.hasRunningThreads()}`);
    console.log(`step ms: p50 ${percentile(stepTimes, 0.5).toFixed(2)} | p95 ${percentile(stepTimes, 0.95).toFixed(2)} | max ${percentile(stepTimes, 1).toFixed(2)} | avg ${avg.toFixed(2)}`);
    try {
        console.log("gc:", JSON.stringify(mod.getGcStats()));
    } catch { /* ignore */ }
}

main();
