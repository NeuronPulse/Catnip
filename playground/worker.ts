
import { run } from "../src/index";
import { ICatnipRenderer } from "../src/runtime/ICatnipRenderer";

type ToMainMessage =
    | { kind: "penLines", data: Float32Array, length: number }
    | { kind: "penErase" }
    | { kind: "frame" }
    | { kind: "ready" }
    | { kind: "error", message: string };

type FromMainMessage =
    | { kind: "key", down: boolean, keyCode: number }
    | { kind: "mouseMove", x: number, y: number }
    | { kind: "mouseDown" }
    | { kind: "mouseUp" }
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

    public frame(): void {
        // The main thread draws on its own rAF loop, this just marks a new frame.
        workerScope.postMessage({ kind: "frame" });
    }
}

async function main() {
    const moduleRequest = await fetch('catnip.wasm');
    // const sb3File = await (await fetch('Project.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('Variable inlining bug.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('Conway.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('Mandlebrot Set Benchmark.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('lines.sb3')).arrayBuffer();
    // const sb3File = await (await fetch('fib.sb3')).arrayBuffer();
    const sb3File = await (await fetch('LOS.sb3')).arrayBuffer();
    const module = await WebAssembly.compileStreaming(moduleRequest);

    const project = await run(module, sb3File, new RemoteRenderer());
    const projectModule = await project.compile({
        // enable_optimization_binaryen: false,
        enable_optimization_variable_inlining: false,
    });

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
            case "event":
                projectModule.triggerEvent(message.id as any, ...message.args);
                break;
        }
    });

    (self as any).project = projectModule;

    const stepRate = 30;
    let intervalToken: any;

    function frame() {
        try {
            projectModule.step();
            projectModule.frame();
        } catch (e) {
            console.error("Error while stepping project.");
            console.error(e);
            clearInterval(intervalToken);
            workerScope.postMessage({ kind: "error", message: String(e) });
        }
    }

    projectModule.start();

    intervalToken = setInterval(frame, 1000 / stepRate);

    workerScope.postMessage({ kind: "ready" });
}

workerScope.addEventListener("error", (event) => {
    workerScope.postMessage({ kind: "error", message: event.message });
});

main().catch((e) => {
    console.error(e);
    workerScope.postMessage({ kind: "error", message: String(e && e.message ? e.message : e) });
});
