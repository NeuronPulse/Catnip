
export interface CatnipCompilerConfig {
    dump_binaryen: false | "wat" | "as" | "stack";
    dump_ir: boolean;
    dump_wasm_blob: boolean;
    /** Prints a per-stage timing table after compilation (for benchmarking). */
    dump_stage_timings: boolean;
    enable_tail_call: boolean;
    /**
     * `false` skips binaryen entirely. `true` picks an optimize level from the
     * size of the module — skipping binaryen altogether when the module is too
     * large for optimizing to be worth its cost (see
     * {@link catnipBinaryenOptimizeLevelForSize}). A number forces that level,
     * which is what benchmarks use to compare them.
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
 * Modules at least this large are not optimized by binaryen at all. Below it
 * binaryen is fast enough (well under a second) that full optimization costs
 * nothing worth reclaiming.
 */
export const CATNIP_BINARYEN_DOWNGRADE_BYTES = 64 * 1024;

/** Optimize level used for modules below {@link CATNIP_BINARYEN_DOWNGRADE_BYTES}. */
export const CATNIP_BINARYEN_DEFAULT_LEVEL = 4;

/**
 * Picks binaryen's optimize level from the size of the module to optimize, or
 * `null` when the module is too large for optimizing to be worth it.
 *
 * binaryen's pipeline is superlinear in module size while the generated wasm
 * does not measurably benefit from it: measured with `bench.ts` (see PLAN.md),
 * a level 4 optimize costs 6.3s on LOS.sb3 (166KiB module) and 14.3s on
 * Conway.sb3 (936KiB); level 1 costs 2.5s and 7.8s, level 0 (which still pays
 * binaryen's read and emit round trip) 0.2s and 0.6s, against 0.2s and 0.5s for
 * skipping binaryen. Level 1's 15% smaller module is the only difference that
 * came out of it: the stepped projects run at the same speed with binaryen at
 * level 4, level 1, level 0 and off — even fib.sb3's pure-numeric warp loop,
 * 120M iterations per step — and `WebAssembly.compile` of the module does not
 * notice the size (3.1ms vs 8.1ms for Conway's 958KiB and 811KiB). Small
 * modules therefore keep the thorough level, and large ones skip binaryen
 * instead of paying seconds for a smaller download.
 */
export function catnipBinaryenOptimizeLevelForSize(moduleBytes: number): number | null {
    return moduleBytes >= CATNIP_BINARYEN_DOWNGRADE_BYTES ?
        null : CATNIP_BINARYEN_DEFAULT_LEVEL;
}