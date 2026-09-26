import { CatnipRuntimeModule } from "./runtime/CatnipRuntimeModule";
import JSZip from "jszip";
import { readSB3 } from "./sb3_reader";
import { ICatnipRenderer } from "./runtime/ICatnipRenderer";
import { DummyRenderer } from "./runtime/DummyRenderer";
import { CatnipProject } from "./runtime/CatnipProject";


export async function run(runtimeModule: WebAssembly.Module, file: ArrayBuffer, renderer?: ICatnipRenderer): Promise<CatnipProject> {

    // Reading the project and creating the runtime are independent, and neither
    // is quick: instantiating the wasm module happens while the zip is being
    // read and the project JSON is being parsed.
    const runtimePromise = CatnipRuntimeModule.create(runtimeModule, renderer ?? new DummyRenderer());

    const jszip = new JSZip();

    const myzip = await jszip.loadAsync(file);

    // JSZip decodes utf8 in JavaScript, which on a project with a hundred
    // megabytes of JSON costs several times what TextDecoder does natively.
    const projectBytes = await myzip.file("project.json")!.async("uint8array");
    const projectJSON = new TextDecoder().decode(projectBytes);

    const projectDesc = readSB3(JSON.parse(projectJSON), {
        allow_unknown_opcodes: true
    });

    const runtime = await runtimePromise;

    return runtime.loadProject(projectDesc);
}