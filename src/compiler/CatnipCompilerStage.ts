
export enum CatnipCompilerStage {
    IR_CREATION,
    IR_PRE_ANLYSIS,
    IR_GEN,
    PASS_PRE_ANALYSIS,
    PASS_ANALYSIS,
    PASS_POST_ANALYSIS,
    PASS_PRE_WASM_GEN,
    IR_WASM_GEN,
    EVENT_WASM_GEN,
    MODULE_CREATION,
}

/** Display names for CatnipCompilerStage, keyed by the enum value. */
export const CatnipCompilerStageNames: Record<CatnipCompilerStage, string> = {
    [CatnipCompilerStage.IR_CREATION]: "IR_CREATION",
    [CatnipCompilerStage.IR_PRE_ANLYSIS]: "IR_PRE_ANALYSIS",
    [CatnipCompilerStage.IR_GEN]: "IR_GEN",
    [CatnipCompilerStage.PASS_PRE_ANALYSIS]: "PASS_PRE_ANALYSIS",
    [CatnipCompilerStage.PASS_ANALYSIS]: "PASS_ANALYSIS",
    [CatnipCompilerStage.PASS_POST_ANALYSIS]: "PASS_POST_ANALYSIS",
    [CatnipCompilerStage.PASS_PRE_WASM_GEN]: "PASS_PRE_WASM_GEN",
    [CatnipCompilerStage.IR_WASM_GEN]: "IR_WASM_GEN",
    [CatnipCompilerStage.EVENT_WASM_GEN]: "EVENT_WASM_GEN",
    [CatnipCompilerStage.MODULE_CREATION]: "MODULE_CREATION",
};

export type CatnipCompilerPassStage = 
    CatnipCompilerStage.PASS_PRE_ANALYSIS |
    CatnipCompilerStage.PASS_ANALYSIS |
    CatnipCompilerStage.PASS_POST_ANALYSIS |
    CatnipCompilerStage.PASS_PRE_WASM_GEN;