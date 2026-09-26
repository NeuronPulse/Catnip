
import { CatnipRenderer } from "../renderer";

type WorkerMessage =
    | { kind: "penLines", data: Float32Array, length: number }
    | { kind: "penErase" }
    | { kind: "frame" }
    | { kind: "stepRate", hz: number }
    | { kind: "ready" }
    | { kind: "error", message: string };

async function main() {
    const renderer = new CatnipRenderer();
    const worker = new Worker("worker.js");

    let drawPending = false;

    function draw() {
        if (drawPending) {
            drawPending = false;
            try {
                renderer.frame();
            } catch (e) {
                console.error("Error while drawing frame.");
                console.error(e);
            }
        }
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    function attachInput() {
        document.addEventListener("keydown", (event) => {
            worker.postMessage({ kind: "key", down: true, keyCode: event.keyCode });
        });

        document.addEventListener("keyup", (event) => {
            worker.postMessage({ kind: "key", down: false, keyCode: event.keyCode });
        });

        document.addEventListener("mousemove", (event) => {
            const canvasElement = renderer.canvasElement;
            const rect = canvasElement.getBoundingClientRect();

            const mouseX = (event.clientX - rect.left) / canvasElement.width;
            const mouseY = (event.clientY - rect.top) / canvasElement.height;

            const centeredX = mouseX - 0.5;
            const centeredY = mouseY - 0.5;

            worker.postMessage({ kind: "mouseMove", x: centeredX * 480, y: -centeredY * 360 });
        });

        document.addEventListener("mouseup", () => {
            worker.postMessage({ kind: "mouseUp" });
        });

        document.addEventListener("mousedown", () => {
            worker.postMessage({ kind: "mouseDown" });
        });
    }

    worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        switch (message.kind) {
            case "penLines":
                renderer.penDrawLines(message.data, message.length);
                drawPending = true;
                break;
            case "penErase":
                renderer.penEraseAll();
                drawPending = true;
                break;
            case "frame":
                drawPending = true;
                break;
            case "stepRate":
                console.info(`[catnip] step rate: ${message.hz}Hz`);
                break;
            case "ready":
                attachInput();
                console.info("[catnip] worker ready");
                break;
            case "error":
                console.error("[catnip worker]", message.message);
                break;
        }
    });

    worker.addEventListener("error", (event) => {
        console.error("[catnip worker]", event.message);
    });

    // The project module lives in the worker, expose a proxy for console fiddling.
    (globalThis as any).project = {
        triggerEvent: (id: string, ...args: number[]) => worker.postMessage({ kind: "event", id, args }),
        /** Simulation steps per second. Rendering runs on rAF at its own rate. */
        setStepRate: (hz: number) => worker.postMessage({ kind: "stepRate", hz }),
    };
}

(globalThis as any).main = main;
