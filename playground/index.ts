
import { CatnipScratchRenderer, CatnipCostumeAsset, CatnipTargetRenderInfo } from "../renderer/scratch";

type WorkerMessage =
    | { kind: "penLines", data: Float32Array, length: number }
    | { kind: "penErase" }
    | { kind: "drawState", data: Float32Array }
    | { kind: "layer", data: Int32Array }
    | { kind: "frame" }
    | { kind: "targets", targets: CatnipTargetRenderInfo[] }
    | { kind: "costumes", costumes: CatnipCostumeAsset[] }
    | { kind: "stepRate", hz: number }
    | { kind: "ready" }
    | { kind: "error", message: string };

/**
 * The Scratch key code a DOM key event is about, or null for a key Scratch
 * does not treat as a key.
 *
 * Mirrors Keyboard._keyStringToScratchKey in scratch-vm: a key is a single
 * character, upper-cased, plus the space, arrow and enter keys. Everything
 * else — modifiers, function keys, non-English letters — is not a key, and
 * counting those would make "key any pressed?" answer yes for them.
 */
function scratchKeyCode(event: KeyboardEvent): number | null {
    switch (event.key) {
        case " ": return 32;
        case "Enter": return 13;
        case "ArrowLeft": return 37;
        case "ArrowUp": return 38;
        case "ArrowRight": return 39;
        case "ArrowDown": return 40;
    }

    if (event.key.length !== 1) return null;

    const firstChar = event.key.charCodeAt(0);
    const code = (firstChar >= 97 && firstChar <= 122) ? firstChar - 32 : firstChar;

    if (code < 32 || code > 126) return null;

    return code;
}

async function main() {
    const renderer = new CatnipScratchRenderer();
    // Forward the page's query string: the worker reads ?sb3= from its own
    // location.search, which a bare Worker URL would leave empty.
    const worker = new Worker("worker.js" + location.search);

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
            const keyCode = scratchKeyCode(event);
            if (keyCode === null) return;
            worker.postMessage({ kind: "key", down: true, keyCode });
        });

        document.addEventListener("keyup", (event) => {
            const keyCode = scratchKeyCode(event);
            if (keyCode === null) return;
            worker.postMessage({ kind: "key", down: false, keyCode });
        });

        document.addEventListener("mousemove", (event) => {
            const canvasElement = renderer.canvasElement;
            const rect = canvasElement.getBoundingClientRect();

            // The canvas backing store is scaled by the device pixel ratio;
            // the event is in CSS pixels, so measure against the CSS box.
            const mouseX = (event.clientX - rect.left) / rect.width;
            const mouseY = (event.clientY - rect.top) / rect.height;

            const centeredX = mouseX - 0.5;
            const centeredY = mouseY - 0.5;

            worker.postMessage({ kind: "mouseMove", x: centeredX * 480, y: -centeredY * 360 });
        });

        document.addEventListener("mouseup", () => {
            worker.postMessage({ kind: "mouseUp" });
        });

        document.addEventListener("mousedown", (event) => {
            worker.postMessage({ kind: "mouseDown" });

            const canvasElement = renderer.canvasElement;
            const rect = canvasElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Click hats fire on mouse down for non-draggable targets, and
            // only for clicks inside the canvas (scratch-vm's mouse.postData);
            // the pick falls back to the stage when nothing is hit.
            if (x > 0 && x < rect.width && y > 0 && y < rect.height) {
                worker.postMessage({ kind: "click", targetIndex: renderer.pickTargetIndex(x, y) });
            }
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
            case "drawState":
                renderer.applyDrawState(message.data);
                break;
            case "layer":
                renderer.applyLayer(message.data);
                drawPending = true;
                break;
            case "targets":
                renderer.initTargets(message.targets);
                break;
            case "costumes":
                for (const costume of message.costumes)
                    renderer.addCostume(costume);
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
