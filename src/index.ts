import { CatnipRuntimeModule } from "./runtime/CatnipRuntimeModule";
import JSZip from "jszip";
import { readSB3 } from "./sb3_reader";
import { ICatnipRenderer } from "./runtime/ICatnipRenderer";
import { DummyRenderer } from "./runtime/DummyRenderer";
import { CatnipProject } from "./runtime/CatnipProject";
import { createLogger } from "./log";

const logger = createLogger("Catnip");

/**
 * Finds the project's JSON in the zip. Projects saved by some tools (and
 * Scratch's own fixtures) keep their contents in a folder inside the zip
 * rather than at its root, and the macOS resource forks some zips carry along
 * have files that end in `project.json` too.
 */
function findProjectJSON(zip: JSZip): JSZip.JSZipObject | null {
    let found: string | null = null;

    for (const path in zip.files) {
        if (zip.files[path].dir) continue;
        if (!path.endsWith("project.json")) continue;
        if (path.includes("__MACOSX/")) continue;
        if (path.split("/").pop()!.startsWith("._")) continue;

        // The shallowest match is the project; anything deeper is a copy.
        if (found === null || path.length < found.length) found = path;
    }

    return found === null ? null : zip.files[found];
}

/** Reports one phase of loading the project, 0-100 of the loading span. */
export type CatnipLoadProgress = (pct: number, label: string) => void;

export async function run(
    runtimeModule: WebAssembly.Module,
    file: ArrayBuffer,
    renderer?: ICatnipRenderer,
    onProgress?: CatnipLoadProgress,
): Promise<CatnipProject> {

    // Reading the project and creating the runtime are independent, and neither
    // is quick: instantiating the wasm module happens while the zip is being
    // read and the project JSON is being parsed.
    const runtimePromise = CatnipRuntimeModule.create(runtimeModule, renderer ?? new DummyRenderer());

    const jszip = new JSZip();

    let phaseAnchor = performance.now();
    const phase = (name: string) => {
        const now = performance.now();
        logger.log(`[phase] ${name} ${(now - phaseAnchor).toFixed(0)}ms`);
        phaseAnchor = now;
    };

    onProgress?.(14, "inflating project.json");
    const myzip = await jszip.loadAsync(file);

    const projectFile = findProjectJSON(myzip);

    if (projectFile === null)
        throw new Error("The project file does not contain a project.json.");

    // JSZip decodes utf8 in JavaScript, which on a project with a hundred
    // megabytes of JSON costs several times what TextDecoder does natively.
    let projectBytes: Uint8Array | null = await projectFile.async("uint8array");
    phase("zip load + inflate");

    onProgress?.(22, "parsing project.json");
    let projectJSON: string | null = new TextDecoder().decode(projectBytes);
    projectBytes = null; // dead from here; the parse briefly doubles the footprint

    let projectDesc = readSB3(JSON.parse(projectJSON), {
        allow_unknown_opcodes: true
    });
    projectJSON = null; // and so is the big string, before targets + compile
    phase("decode + parse + read blocks");

    onProgress?.(52, "creating targets");
    const runtime = await runtimePromise;

    const project = runtime.loadProject(projectDesc);
    phase("load project");

    // The zip holds the costume assets; the playground reads them out of it
    // after compiling, headless runs never touch it again.
    project.setAssetZip(myzip);

    // Movement blocks fence against each costume's measured box, so it has to
    // be in wasm before anything steps.
    onProgress?.(57, "measuring costumes");
    await project.loadCostumeBounds();
    phase("costume bounds");

    if (project.unsupportedOpcodes.length !== 0) {
        const summary = project.unsupportedOpcodes
            .map(({ opcode, count }) => `${opcode} ×${count}`)
            .join(", ");

        logger.warn(`Project uses blocks Catnip does not implement, they were dropped: ${summary}`);
    }

    onProgress?.(62, "project loaded");
    return project;
}