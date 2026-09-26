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

export async function run(runtimeModule: WebAssembly.Module, file: ArrayBuffer, renderer?: ICatnipRenderer): Promise<CatnipProject> {

    // Reading the project and creating the runtime are independent, and neither
    // is quick: instantiating the wasm module happens while the zip is being
    // read and the project JSON is being parsed.
    const runtimePromise = CatnipRuntimeModule.create(runtimeModule, renderer ?? new DummyRenderer());

    const jszip = new JSZip();

    const myzip = await jszip.loadAsync(file);

    const projectFile = findProjectJSON(myzip);

    if (projectFile === null)
        throw new Error("The project file does not contain a project.json.");

    // JSZip decodes utf8 in JavaScript, which on a project with a hundred
    // megabytes of JSON costs several times what TextDecoder does natively.
    const projectBytes = await projectFile.async("uint8array");
    const projectJSON = new TextDecoder().decode(projectBytes);

    const projectDesc = readSB3(JSON.parse(projectJSON), {
        allow_unknown_opcodes: true
    });

    const runtime = await runtimePromise;

    const project = runtime.loadProject(projectDesc);

    if (project.unsupportedOpcodes.length !== 0) {
        const summary = project.unsupportedOpcodes
            .map(({ opcode, count }) => `${opcode} ×${count}`)
            .join(", ");

        logger.warn(`Project uses blocks Catnip does not implement, they were dropped: ${summary}`);
    }

    return project;
}