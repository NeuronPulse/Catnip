
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

type ToMainMessage =
    | { kind: "penLines", data: Float32Array, length: number }
    | { kind: "penErase" }
    | { kind: "drawState", data: Float32Array }
    | { kind: "frame" }
    | { kind: "targets", targets: TargetInfo[] }
    | { kind: "costumes", costumes: CostumeAsset[] }
    | { kind: "stepRate", hz: number }
    | { kind: "ready" }
    | { kind: "error", message: string };

type FromMainMessage =
    | { kind: "key", down: boolean, keyCode: number }
    | { kind: "mouseMove", x: number, y: number }
    | { kind: "mouseDown" }
    | { kind: "mouseUp" }
    | { kind: "click", targetIndex: number }
    | { kind: "stepRate", hz: number }
    | { kind: "event", id: string, args: number[] };

// `self` is typed as Window by the DOM lib, so narrow it to a worker scope manually.
const workerScope = self as unknown as {
    postMessage(message: any, transfer?: Transferable[]): void;
    addEventListener(type: "message", listener: (event: MessageEvent<FromMainMessage>) => void): void;
    addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
};

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
    const moduleRequest = await fetch('catnip.wasm');
    // const sb3File = await (await fetch('Project.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('Variable inlining bug.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('Conway.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('Mandlebrot Set Benchmark.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('lines.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('fib.sb3')).arrayBuffer();
    // The playground project: ?sb3=<file in public/> overrides the default.
    const sb3Name = new URLSearchParams(self.location.search).get("sb3") ?? "LOS.sb3";
    const sb3File = await (await fetch(sb3Name)).arrayBuffer();
    const module = await WebAssembly.compileStreaming(moduleRequest);

    const project = await run(module, sb3File, new RemoteRenderer());
    const projectModule = await project.compile({
        // enable_optimization_binaryen: false,
        enable_optimization_variable_inlining: false,
    });

    // The page builds the drawables and skins before the first frame goes out.
    const targets = buildTargetInfo(project);
    const costumes = await buildCostumeAssets(project);
    workerScope.postMessage(
        { kind: "targets", targets },
    );
    workerScope.postMessage(
        { kind: "costumes", costumes },
        costumes.map((costume) => costume.data)
    );

    workerScope.addEventListener("message", (event) => {
        const message = event.data;
        switch (message.kind) {
            case "key":
                projectModule.triggerEvent(message.down ? "IO_KEY_PRESSED" : "IO_KEY_RELEASED", message.keyCode);
                break;
            case "mouseMove":
                projectModule.triggerEvent("IO_MOUSE_MOVE", message.x, message.y);
                break;
            case "mouseDown":
                projectModule.triggerEvent("IO_MOUSE_DOWN");
                break;
            case "mouseUp":
                projectModule.triggerEvent("IO_MOUSE_UP");
                break;
            case "click": {
                // The pick gives an index in project.sprites order (the same
                // order the draw states are packed in); the event carries the
                // clicked target's pointer.
                let targetIndex = 0;
                for (const sprite of project.sprites) {
                    if (targetIndex++ === message.targetIndex) {
                        projectModule.triggerEvent("IO_CLICK_TARGET", sprite.defaultTarget.structWrapper.ptr);
                        break;
                    }
                }
                break;
            }
            case "stepRate":
                setStepRate(message.hz);
                break;
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

    workerScope.postMessage({ kind: "ready" });
}

workerScope.addEventListener("error", (event) => {
    workerScope.postMessage({ kind: "error", message: event.message });
});

main().catch((e) => {
    console.error(e);
    workerScope.postMessage({ kind: "error", message: String(e && e.message ? e.message : e) });
});
