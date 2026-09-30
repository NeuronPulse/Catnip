
import { run } from "../src/index";
import { ICatnipRenderer } from "../src/runtime/ICatnipRenderer";
import { CATNIP_DEFAULT_STEP_RATE } from "../src/runtime/CatnipRuntimeModule";
import { CatnipProject } from "../src/runtime/CatnipProject";
import { CATNIP_TARGET_FLAG_IS_STAGE } from "../src/wasm-interop/CatnipWasmStructTarget";

/** Static description of one renderable target, sent once after compiling. */
type TargetInfo = {
    index: number,
    isStage: boolean,
    layerOrder: number,
    rotationStyle: "all around" | "left-right" | "don't rotate",
    costumeCount: number,
    name: string,
};

/** One costume's raw bytes and the metadata needed to turn them into a skin. */
type CostumeAsset = {
    targetIndex: number,
    costumeIndex: number,
    dataFormat: string,
    bitmapResolution: number,
    rotationCenterX: number,
    rotationCenterY: number,
    data: ArrayBuffer,
};

/** One line of worker output, destined for the page's log panel. */
type LogEntry = {
    level: "log" | "info" | "warn" | "error" | "debug",
    text: string,
};

type ToMainMessage =
    | { kind: "penLines", data: Float32Array, length: number }
    | { kind: "penErase" }
    | { kind: "drawState", data: Float32Array }
    | { kind: "layer", data: Int32Array }
    | { kind: "bubble", data: import("../src/runtime/ICatnipRenderer").CatnipBubbleUpdate[] }
    | { kind: "cloneAdd", slot: number, spriteIndex: number }
    | { kind: "cloneRemove", slot: number }
    | { kind: "frame" }
    | { kind: "targets", targets: TargetInfo[] }
    | { kind: "costumes", costumes: CostumeAsset[] }
    | { kind: "stepRate", hz: number }
    | { kind: "progress", pct: number, label: string }
    | { kind: "log", entries: LogEntry[] }
    | { kind: "ask", question: string | null }
    | { kind: "ready" }
    | { kind: "error", message: string };

type FromMainMessage =
    | { kind: "key", down: boolean, keyCode: number }
    | { kind: "mouseMove", x: number, y: number }
    | { kind: "mouseDown" }
    | { kind: "mouseUp" }
    | { kind: "click", targetIndex: number }
    | { kind: "stepRate", hz: number }
    | { kind: "answer", text: string }
    | { kind: "event", id: string, args: number[] };

// `self` is typed as Window by the DOM lib, so narrow it to a worker scope manually.
const workerScope = self as unknown as {
    postMessage(message: any, transfer?: Transferable[]): void;
    addEventListener(type: "message", listener: (event: MessageEvent<FromMainMessage>) => void): void;
    addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
};

// Everything the worker would print goes to the page's log panel instead:
// printing to the devtools console from a busy worker is what froze the
// browser. Entries are batched so a chatty project cannot flood the message
// channel either — anything past a full batch is counted and dropped.
const MAX_LOG_BATCH = 300;
const pendingLogs: LogEntry[] = [];
let droppedLogs = 0;
let logFlushTimer: ReturnType<typeof setTimeout> | null = null;

function stringifyLogArg(value: unknown): string {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack ?? String(value);
    try {
        const json = JSON.stringify(value);
        return json === undefined ? String(value) : json;
    } catch {
        return String(value);
    }
}

function flushLogs(): void {
    logFlushTimer = null;
    if (pendingLogs.length === 0 && droppedLogs === 0) return;

    const entries = pendingLogs.splice(0, MAX_LOG_BATCH);
    if (pendingLogs.length > 0) {
        droppedLogs += pendingLogs.length;
        pendingLogs.length = 0;
    }
    if (droppedLogs > 0) {
        entries.push({ level: "warn", text: `… ${droppedLogs} messages dropped` });
        droppedLogs = 0;
    }

    workerScope.postMessage({ kind: "log", entries });
}

function captureLog(level: LogEntry["level"], args: unknown[]): void {
    pendingLogs.push({ level, text: args.map(stringifyLogArg).join(" ") });

    if (pendingLogs.length >= MAX_LOG_BATCH) flushLogs();
    else if (logFlushTimer === null) logFlushTimer = setTimeout(flushLogs, 100);
}

for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    console[level] = (...args: unknown[]) => captureLog(level, args);
}

/** Compile/load progress for the page's bar. Send, then let it deliver. */
function progress(pct: number, label: string): void {
    workerScope.postMessage({ kind: "progress", pct, label });
}

async function yieldForDelivery(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Phase mark: every gap between marks lands in the log panel as [phase] …ms. */
let phaseAnchor = performance.now();

function phase(name: string): void {
    const now = performance.now();
    console.log(`[phase] ${name} ${(now - phaseAnchor).toFixed(0)}ms`);
    phaseAnchor = now;
}

class RemoteRenderer implements ICatnipRenderer {
    public penDrawLines(data: Float32Array, length: number): void {
        // The runtime hands us a fresh buffer each time, so it can be moved instead of copied.
        workerScope.postMessage({ kind: "penLines", data, length }, [data.buffer]);
    }

    public penEraseAll(): void {
        workerScope.postMessage({ kind: "penErase" });
    }

    public drawState(data: Float32Array): void {
        // Fresh buffer every frame; move it rather than copy it.
        workerScope.postMessage({ kind: "drawState", data }, [data.buffer]);
    }

    public layer(data: Int32Array): void {
        // Only sent when a layer op moved something; still a fresh buffer.
        workerScope.postMessage({ kind: "layer", data }, [data.buffer]);
    }

    public bubble(data: import("../src/runtime/ICatnipRenderer").CatnipBubbleUpdate[]): void {
        // Sent only when a bubble changed; small JSON payloads.
        workerScope.postMessage({ kind: "bubble", data });
    }

    public cloneAdd(slot: number, spriteIndex: number): void {
        // Small control message; must arrive before the drawState that
        // first mentions the slot (postMessage keeps order).
        workerScope.postMessage({ kind: "cloneAdd", slot, spriteIndex });
    }

    public cloneRemove(slot: number): void {
        workerScope.postMessage({ kind: "cloneRemove", slot });
    }

    public frame(): void {
        // The main thread draws on its own rAF loop, this just marks a new frame.
        workerScope.postMessage({ kind: "frame" });
    }
}

/** Describes every target for the page, in the order draw states are packed. */
function buildTargetInfo(project: CatnipProject): TargetInfo[] {
    const targets: TargetInfo[] = [];

    for (const sprite of project.sprites) {
        const struct = sprite.defaultTarget.structWrapper;

        targets.push({
            index: targets.length,
            isStage: (struct.getMember("flags") & CATNIP_TARGET_FLAG_IS_STAGE) !== 0,
            layerOrder: sprite.defaultTarget.layerOrder,
            rotationStyle: sprite.defaultTarget.rotationStyle,
            costumeCount: sprite.costumes.length,
            name: sprite.name,
        });
    }

    return targets;
}

/** Inflates every costume asset the project references. */
async function buildCostumeAssets(project: CatnipProject): Promise<CostumeAsset[]> {
    const costumes: CostumeAsset[] = [];

    let targetIndex = 0;
    for (const sprite of project.sprites) {
        for (const costume of sprite.costumes) {
            let data: Uint8Array;
            try {
                data = await project.readAsset(costume.md5ext);
            } catch (e) {
                // A missing asset must not keep the whole project from running;
                // the page renders the target without that costume.
                console.warn(`[catnip] skipping costume asset '${costume.md5ext}':`, e);
                continue;
            }

            // jszip hands back a fresh array, so its buffer is safe to move;
            // the check only guards against it ever handing back a view.
            const buffer = (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength)
                ? data.buffer as ArrayBuffer
                : data.slice().buffer as ArrayBuffer;

            costumes.push({
                targetIndex,
                costumeIndex: costume.index,
                dataFormat: costume.dataFormat,
                bitmapResolution: costume.bitmapResolution,
                rotationCenterX: costume.rotationCenterX,
                rotationCenterY: costume.rotationCenterY,
                data: buffer,
            });
        }
        targetIndex++;
    }

    return costumes;
}

async function main() {
    progress(2, "starting");
    await yieldForDelivery();

    const moduleRequest = fetch('catnip.wasm');
    // const sb3File = await (await fetch('Project.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('Variable inlining bug.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('Conway.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('Mandlebrot Set Benchmark.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('lines.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('fib.sb3')).arrayBuffer();
    // The playground project: ?sb3=<file in public/> overrides the default.
    const sb3Name = new URLSearchParams(self.location.search).get("sb3") ?? "LOS.sb3";

    progress(5, "fetching files");
    await yieldForDelivery();
    const sb3File = await (await fetch(sb3Name)).arrayBuffer();
    const module = await WebAssembly.compileStreaming(moduleRequest);
    phase("fetch + wasm compile");

    progress(9, "loading project");
    await yieldForDelivery();
    const project = await run(module, sb3File, new RemoteRenderer(), (pct, label) => {
        progress(pct, label);
    });
    phase("run (read project)");

    // The ask prompt crosses to the page as a message; answers come back
    // through the same channel and into the C-side queue.
    project.runtimeModule.onAskQuestion = (question) =>
        workerScope.postMessage({ kind: "ask", question });

    progress(62, "compiling");
    await yieldForDelivery();
    const projectModule = await project.compile({
        // enable_optimization_binaryen: false,
        enable_optimization_variable_inlining: false,
    });
    phase("compile");

    progress(85, "building render data");
    await yieldForDelivery();
    // The page builds the drawables and skins before the first frame goes out.
    const targets = buildTargetInfo(project);
    const costumes = await buildCostumeAssets(project);
    // The bounds pass already inflated every costume for measurement; with the
    // page transfer done the cache only holds detached buffers now.
    project.clearAssetCache();
    workerScope.postMessage(
        { kind: "targets", targets },
    );
    workerScope.postMessage(
        { kind: "costumes", costumes },
        // With the read cache, costumes sharing one file share one buffer;
        // a transfer list must list each buffer only once.
        [...new Set(costumes.map((costume) => costume.data))]
    );
    phase("costumes + targets");

    workerScope.addEventListener("message", (event) => {
        const message = event.data;
        switch (message.kind) {
            case "key":
                projectModule.triggerEvent(message.down ? "IO_KEY_PRESSED" : "IO_KEY_RELEASED", message.keyCode);
                break;
            case "mouseMove":
                projectModule.mouseMove(message.x, message.y);
                break;
            case "mouseDown":
                projectModule.triggerEvent("IO_MOUSE_DOWN");
                break;
            case "mouseUp":
                projectModule.mouseUp();
                break;
            case "click": {
                // The pick is an index in draw-state slot order — the
                // originals in project order, then any live clone. Whether
                // it clicks now or starts a drag is the module's call
                // (scratch's mouse.js click rules).
                projectModule.mousePick(message.targetIndex);
                break;
            }
            case "stepRate":
                setStepRate(message.hz);
                break;
            case "answer": {
                const functions = project.runtimeModule.functions;
                functions.catnip_sensing_answer_set(
                    project.runtimeModule.createCanonHString(message.text));
                break;
            }
            case "event":
                projectModule.triggerEvent(message.id as any, ...message.args);
                break;
        }
    });

    (self as any).project = projectModule;

    let intervalToken: any;

    // The simulation steps on its own timer; the main thread renders on rAF and
    // only redraws when the worker reports a new frame.
    function setStepRate(hz: number) {
        projectModule.setStepRate(hz);
        if (intervalToken !== undefined) clearInterval(intervalToken);
        intervalToken = setInterval(frame, 1000 / hz);
        workerScope.postMessage({ kind: "stepRate", hz });
    }

    // Rolling window of frame durations (step + frame) for the periodic report.
    const stepSamples: number[] = [];
    const STEP_SAMPLE_LIMIT = 600;
    let lastStatsAt = performance.now();

    function recordSample(ms: number) {
        if (stepSamples.length >= STEP_SAMPLE_LIMIT) stepSamples.shift();
        stepSamples.push(ms);

        const now = performance.now();
        if (now - lastStatsAt < 5000) return;
        lastStatsAt = now;

        const sorted = [...stepSamples].sort((a, b) => a - b);
        const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(1);
        const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
        console.log(`[step] rate=${projectModule.stepRate}Hz n=${sorted.length} p50=${at(0.5)}ms p95=${at(0.95)}ms max=${at(1)}ms avg=${avg.toFixed(1)}ms`);
        try {
            console.log(`[gc] ${JSON.stringify(projectModule.getGcStats())}`);
        } catch { /* gc stats unavailable */ }
    }

    function frame() {
        const start = performance.now();
        try {
            projectModule.step();
            projectModule.frame();
        } catch (e) {
            console.error("Error while stepping project.");
            console.error(e);
            clearInterval(intervalToken);
            workerScope.postMessage({ kind: "error", message: String(e) });
        }
        recordSample(performance.now() - start);
    }

    projectModule.start();

    setStepRate(CATNIP_DEFAULT_STEP_RATE);

    progress(100, "ready");
    workerScope.postMessage({ kind: "ready" });
}

workerScope.addEventListener("error", (event) => {
    workerScope.postMessage({ kind: "error", message: event.message });
});

main().catch((e) => {
    captureLog("error", [e instanceof Error ? (e.stack ?? String(e)) : String(e)]);
    flushLogs();
    workerScope.postMessage({ kind: "error", message: String(e && e.message ? e.message : e) });
});
