import { CatnipWasmPtrTarget } from "./CatnipWasmStructTarget";
import { WasmBool32, WasmFloat64, WasmPtr, WasmStruct, WasmUInt32, WasmPtrVoid } from "./wasm-types";

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

    glide_start_x: WasmFloat64,
    glide_start_y: WasmFloat64,
    glide_end_x: WasmFloat64,
    glide_end_y: WasmFloat64,
    glide_t0: WasmFloat64,
    glide_duration: WasmFloat64,
});

export const CatnipWasmPtrThread = new WasmPtr(CatnipWasmStructThread);