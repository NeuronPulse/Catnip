
export interface CatnipCompilerConfig {
    dump_binaryen: false | "wat" | "as" | "stack";
    dump_ir: boolean;
    dump_wasm_blob: boolean;
    /** Prints a per-stage timing table after compilation (for benchmarking). */
    dump_stage_timings: boolean;
    enable_tail_call: boolean;
    /**
     * `false` skips binaryen entirely. `true` picks an optimize level from the
     * size of the module (see {@link catnipBinaryenOptimizeLevelForSize}). A
     * number forces that level, which is what benchmarks use to compare them.
     */
    enable_optimization_binaryen: boolean | number;
    enable_optimization_variable_inlining: boolean;
    /** Slows execution down, but useful for testing variable inlining */
    enable_optimization_variable_inlining_force: boolean;
    enable_optimization_type_analysis: boolean;

    enable_warp_timer: boolean;
}

export function catnipCompilerConfigCreateDefault(): CatnipCompilerConfig {
    let def = {
        dump_binaryen: false,
        dump_ir: false,
        dump_wasm_blob: false,
        dump_stage_timings: false,
        enable_tail_call: true,
        enable_optimization_binaryen: true,
        enable_optimization_variable_inlining: true,
        enable_optimization_variable_inlining_force: false,
        enable_optimization_type_analysis: true,
        enable_warp_timer: true,
    } as CatnipCompilerConfig;

    

    // def.dump_binaryen = "stack";
    // def.dump_ir = true;
    // def.dump_wasm_blob = true;
    // def.enable_optimization_binaryen = false;
    // def.enable_optimization_variable_inlining = false;
    // def.enable_optimization_type_analysis = false;

    return def;
}

export function catnipCompilerConfigPoppulate(partialConfig?: Partial<CatnipCompilerConfig>) : CatnipCompilerConfig {
    const config = catnipCompilerConfigCreateDefault();

    if (partialConfig === undefined) return config;

    for (const key of Object.keys(partialConfig)) {
        (config as any)[key] = (partialConfig as any)[key];
    }

    return config;
}

/**
 * Modules at least this large get a cheaper binaryen optimize level. Below it
 * binaryen is fast enough (well under a second) that full optimization costs
 * nothing worth reclaiming.
 */
export const CATNIP_BINARYEN_DOWNGRADE_BYTES = 64 * 1024;

/** Optimize level used for modules at or above {@link CATNIP_BINARYEN_DOWNGRADE_BYTES}. */
export const CATNIP_BINARYEN_DOWNGRADE_LEVEL = 1;

/** Optimize level used for modules below {@link CATNIP_BINARYEN_DOWNGRADE_BYTES}. */
export const CATNIP_BINARYEN_DEFAULT_LEVEL = 4;

/**
 * Picks binaryen's optimize level from the size of the module to optimize.
 *
 * binaryen's pipeline is superlinear in module size while the generated wasm
 * does not measurably benefit from the more expensive levels: measured with
 * `bench.ts` (see PLAN.md), a level 4 optimize costs 6.3s on LOS.sb3 (166KiB
 * module) and 14.3s on Conway.sb3 (936KiB), against 2.5s and 7.8s at level 1,
 * while the stepped projects run at the same speed either way — even fib.sb3's
 * pure-numeric warp loop, 120M iterations per step, times the same with
 * binaryen off, at level 1, and at level 4. Levels in between (2, 3) sit between
 * the two costs and were likewise equal at runtime, so there is nothing to gain
 * from the extra tiers: big projects get the cheap level, small ones keep the
 * thorough one.
 */
export function catnipBinaryenOptimizeLevelForSize(moduleBytes: number): number {
    return moduleBytes >= CATNIP_BINARYEN_DOWNGRADE_BYTES ?
        CATNIP_BINARYEN_DOWNGRADE_LEVEL : CATNIP_BINARYEN_DEFAULT_LEVEL;
}