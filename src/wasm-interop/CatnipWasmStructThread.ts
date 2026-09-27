import { CatnipWasmPtrTarget } from "./CatnipWasmStructTarget";
import { WasmBool32, WasmPtr, WasmStruct, WasmUInt32, WasmPtrVoid } from "./wasm-types";

export const CatnipWasmStructThread = new WasmStruct("catnip_thread", {
    
    runtime: WasmPtrVoid,
    target: CatnipWasmPtrTarget,
    function: WasmPtrVoid,
    status: WasmUInt32,

    entrypoint: WasmPtrVoid,
    restart_pending: WasmBool32,

    stack_ptr: WasmPtrVoid,
    stack_end: WasmPtrVoid,
    stack_start: WasmPtrVoid,

    ref_count: WasmUInt32,

});

export const CatnipWasmPtrThread = new WasmPtr(CatnipWasmStructThread);