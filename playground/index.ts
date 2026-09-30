
import { CatnipScratchRenderer, CatnipCostumeAsset, CatnipTargetRenderInfo } from "../renderer/scratch";

type WorkerMessage =
    | { kind: "penLines", data: Float32Array, length: number }
    | { kind: "penErase" }
    | { kind: "drawState", data: Float32Array }
    | { kind: "layer", data: Int32Array }
    | { kind: "bubble", data: import("../src/runtime/ICatnipRenderer").CatnipBubbleUpdate[] }
    | { kind: "cloneAdd", slot: number, spriteIndex: number }
    | { kind: "cloneRemove", slot: number }
    | { kind: "frame" }
    | { kind: "targets", targets: CatnipTargetRenderInfo[] }
    | { kind: "costumes", costumes: CatnipCostumeAsset[] }
    | { kind: "stepRate", hz: number }
    | { kind: "progress", pct: number, label: string }
    | { kind: "log", entries: { level: string, text: string }[] }
    | { kind: "ask", question: string | null }
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

    // Everything the worker and the page would print lands in the on-page
    // panel: printing to the devtools console is what made the demo stall.
    const runButton = document.getElementById("run") as HTMLButtonElement | null;
    const statusElement = document.getElementById("status");
    const barFill = document.getElementById("bar-fill");
    const barLabel = document.getElementById("bar-label");
    const logElement = document.getElementById("log");
    const askElement = document.getElementById("ask");
    const askText = document.getElementById("ask-text");
    const askInput = document.getElementById("ask-input") as HTMLInputElement | null;

    runButton?.setAttribute("disabled", "");

    const MAX_LOG_LINES = 300;
    const logLines: string[] = [];

    function appendLog(lines: string[], level?: string): void {
        if (logElement === null) return;

        if (level === "warn") lines = lines.map((line) => "[warn] " + line);
        else if (level === "error") lines = lines.map((line) => "[error] " + line);

        for (const line of lines) logLines.push(line);
        while (logLines.length > MAX_LOG_LINES) logLines.shift();

        logElement.style.display = "block";
        logElement.textContent = logLines.join("\n");
        logElement.scrollTop = logElement.scrollHeight;
    }

    // One phase can own the worker for tens of seconds (parsing a 174 MB
    // project.json); the tick keeps the label alive so it never looks stuck.
    let progressState: { pct: number, label: string, done: boolean } | null = null;

    function renderProgress(): void {
        if (progressState === null) return;
        if (statusElement !== null) statusElement.style.display = "flex";
        if (barFill !== null) barFill.style.width = Math.max(0, Math.min(100, progressState.pct)) + "%";
        if (barLabel !== null) {
            const secs = ((performance.now() - progressTickAt) / 1000).toFixed(0);
            barLabel.textContent = progressState.done
                ? `${progressState.label} ${progressState.pct}%`
                : `${progressState.label} ${progressState.pct}% (${secs}s)`;
        }
    }

    let progressTickAt = performance.now();

    function setProgress(pct: number, label: string, done = false): void {
        progressTickAt = performance.now();
        progressState = { pct, label, done };
        renderProgress();
    }

    setInterval(() => { if (progressState !== null && !progressState.done) renderProgress(); }, 1000);

    // Forward the page's query string: the worker reads ?sb3= from its own
    // location.search, which a bare Worker URL would leave empty.
    const worker = new Worker("worker.js" + location.search);

    // Ask and wait: the worker's C-side queue calls onAskQuestion here; the
    // answer goes straight back into the queue through the answer message.
    function submitAnswer(): void {
        if (askElement === null || askInput === null) return;
        worker.postMessage({ kind: "answer", text: askInput.value });
        askInput.value = "";
        askElement.style.display = "none";
    }

    askInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            submitAnswer();
        }
        // While the answer box has focus, typing is for the project's
        // answer block, not for the scratch key listeners on document.
        event.stopPropagation();
    });

    document.getElementById("ask-ok")?.addEventListener("click", submitAnswer);
    askElement?.addEventListener("click", () => askInput?.focus());

    let drawPending = false;

    function draw() {
        if (drawPending) {
            drawPending = false;
            try {
                renderer.frame();
            } catch (e) {
                appendLog(["error while drawing a frame: " + String(e)], "error");
            }
        }
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    function attachInput() {
        document.addEventListener("keydown", (event) => {
            if (event.target instanceof HTMLInputElement) return;
            const keyCode = scratchKeyCode(event);
            if (keyCode === null) return;
            worker.postMessage({ kind: "key", down: true, keyCode });
        });

        document.addEventListener("keyup", (event) => {
            if (event.target instanceof HTMLInputElement) return;
            const keyCode = scratchKeyCode(event);
            if (keyCode === null) return;
            worker.postMessage({ kind: "key", down: false, keyCode });
        });

        // Clicks on the ask prompt belong to the answer box, not to the
        // project's mouse state or click hats (scratch's mouse guards the
        // ask input the same way).
        const onAskUI = (event: Event) =>
            (event.target as HTMLElement | null)?.closest?.("#ask") != null;

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

        document.addEventListener("mouseup", (event) => {
            if (onAskUI(event)) return;
            worker.postMessage({ kind: "mouseUp" });
        });

        document.addEventListener("mousedown", (event) => {
            if (onAskUI(event)) return;
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
            case "bubble":
                renderer.bubble(message.data);
                drawPending = true;
                break;
            case "cloneAdd":
                renderer.cloneAdd(message.slot, message.spriteIndex);
                drawPending = true;
                break;
            case "cloneRemove":
                renderer.cloneRemove(message.slot);
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
                appendLog([`step rate: ${message.hz}Hz`]);
                break;
            case "progress":
                setProgress(message.pct, message.label);
                break;
            case "log":
                appendLog(message.entries.map((entry) =>
                    (entry.level === "warn" ? "[warn] " : entry.level === "error" ? "[error] " : "") + entry.text));
                break;
            case "ask":
                if (message.question === null) {
                    if (askElement !== null) askElement.style.display = "none";
                } else {
                    if (askText !== null) askText.textContent = message.question;
                    if (askElement !== null) askElement.style.display = "flex";
                    askInput?.focus();
                }
                break;
            case "ready":
                attachInput();
                setProgress(100, "ready", true);
                appendLog(["worker ready"]);
                break;
            case "error":
                appendLog([message.message], "error");
                break;
        }
    });

    worker.addEventListener("error", (event) => {
        appendLog([event.message], "error");
    });

    // The project module lives in the worker, expose a proxy for console fiddling.
    (globalThis as any).project = {
        triggerEvent: (id: string, ...args: number[]) => worker.postMessage({ kind: "event", id, args }),
        /** Simulation steps per second. Rendering runs on rAF at its own rate. */
        setStepRate: (hz: number) => worker.postMessage({ kind: "stepRate", hz }),
    };
}

(globalThis as any).main = main;
