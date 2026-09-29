
import { SpiderNumberType, SpiderValueType } from 'wasm-spider';

export interface CatnipRuntimeModuleFunction<TResult extends SpiderValueType | undefined, TArgs extends SpiderValueType[]> {
    result: TResult,
    args: TArgs
}

function fn<TArgs extends SpiderValueType[], TResult extends SpiderValueType | undefined = undefined>(args: TArgs, result: TResult): CatnipRuntimeModuleFunction<TResult, TArgs> {
    return { args, result };
}

export const CatnipRuntimeModuleFunctions = {
    catnip_init: fn<[]>([], undefined),
    
    catnip_mem_alloc: fn<[length: SpiderNumberType.i32, zero: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_mem_free: fn<[ptr: SpiderNumberType.i32], undefined>
        ([SpiderNumberType.i32], undefined),

    catnip_numconv_stringify_f64: fn<[val: SpiderNumberType.f64, runtime: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.f64, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_numconv_parse: fn<[str: SpiderNumberType.i32, runtime: SpiderNumberType.i32], SpiderNumberType.f64>
        ([SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.f64),

    catnip_runtime_new: fn<[], SpiderNumberType.i32>
        ([], SpiderNumberType.i32),
    catnip_runtime_tick: fn<[runtime: SpiderNumberType.i32], undefined>
        ([SpiderNumberType.i32], undefined),
    catnip_runtime_warp_expired: fn<[runtime: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_runtime_start_threads: fn<[
        runtime: SpiderNumberType.i32,
        sprite: SpiderNumberType.i32,
        entrypoint: SpiderNumberType.i32,
        threadList: SpiderNumberType.i32
    ], undefined>([SpiderNumberType.i32, SpiderNumberType.i32, SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_runtime_render_pen_flush: fn<[runtime: SpiderNumberType.i32]>([SpiderNumberType.i32], undefined),
    catnip_runtime_new_hstring: fn<[runtime: SpiderNumberType.i32, length: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),

    catnip_target_new: fn<[runtime: SpiderNumberType.i32, sprite: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_target_start_thread: fn<[target: SpiderNumberType.i32, entrypoint: SpiderNumberType.i32, threadList: SpiderNumberType.i32, mode: SpiderNumberType.i32], undefined>
        ([SpiderNumberType.i32, SpiderNumberType.i32, SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_target_set_xy: fn<[x: SpiderNumberType.f64, y: SpiderNumberType.f64, target: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.f64, SpiderNumberType.i32], undefined),

    catnip_motion_movesteps: fn<[steps: SpiderNumberType.f64, target: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.i32], undefined),
    catnip_motion_turnright: fn<[degrees: SpiderNumberType.f64, target: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.i32], undefined),
    catnip_motion_turnleft: fn<[degrees: SpiderNumberType.f64, target: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.i32], undefined),
    catnip_motion_point_direction: fn<[direction: SpiderNumberType.f64, target: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.i32], undefined),
    catnip_motion_point_towards: fn<[towards: SpiderNumberType.i32, target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_motion_goto: fn<[to: SpiderNumberType.i32, target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_motion_bounce: fn<[target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32], undefined),
    catnip_motion_set_rotation_style: fn<[style: SpiderNumberType.i32, target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_motion_glide_begin_xy: fn<[x: SpiderNumberType.f64, y: SpiderNumberType.f64, secs: SpiderNumberType.f64, target: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.f64, SpiderNumberType.f64, SpiderNumberType.i32], undefined),
    catnip_motion_glide_begin_to: fn<[to: SpiderNumberType.i32, secs: SpiderNumberType.f64, target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.f64, SpiderNumberType.i32], undefined),
    catnip_motion_glide_step: fn<[target: SpiderNumberType.i32], SpiderNumberType.f64>
        ([SpiderNumberType.i32], SpiderNumberType.f64),

    catnip_looks_set_visible: fn<[visible: SpiderNumberType.i32, target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_looks_set_size: fn<[size: SpiderNumberType.f64, target: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.i32], undefined),
    catnip_looks_change_size: fn<[delta: SpiderNumberType.f64, target: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.i32], undefined),
    catnip_looks_get_size: fn<[target: SpiderNumberType.i32], SpiderNumberType.f64>
        ([SpiderNumberType.i32], SpiderNumberType.f64),
    catnip_looks_set_effect: fn<[value: SpiderNumberType.f64, effect: SpiderNumberType.i32, target: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_looks_change_effect: fn<[delta: SpiderNumberType.f64, effect: SpiderNumberType.i32, target: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_looks_clear_effects: fn<[target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32], undefined),
    catnip_looks_next_costume: fn<[target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32], undefined),
    catnip_looks_backdrop_set: fn<[backdrop: SpiderNumberType.i32, runtime: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_looks_next_backdrop: fn<[runtime: SpiderNumberType.i32]>
        ([SpiderNumberType.i32], undefined),
    catnip_looks_backdrop_number: fn<[runtime: SpiderNumberType.i32], SpiderNumberType.f64>
        ([SpiderNumberType.i32], SpiderNumberType.f64),
    catnip_looks_backdrop_name: fn<[runtime: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_looks_goto_front: fn<[target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32], undefined),
    catnip_looks_goto_back: fn<[target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32], undefined),
    catnip_looks_change_layer: fn<[n: SpiderNumberType.f64, target: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.i32], undefined),
    catnip_looks_say: fn<[text: SpiderNumberType.i32, type: SpiderNumberType.i32, target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_looks_clear_if_unchanged: fn<[usage: SpiderNumberType.i32, target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_looks_bubble_format: fn<[value: SpiderNumberType.f64, runtime: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.f64, SpiderNumberType.i32], SpiderNumberType.i32),

    catnip_clone_resolve_source: fn<[option: SpiderNumberType.i32, runtime: SpiderNumberType.i32, current: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_clone_create: fn<[source: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_clone_delete: fn<[target: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_clone_dispose_all: fn<[runtime: SpiderNumberType.i32]>
        ([SpiderNumberType.i32], undefined),
    catnip_looks_go_behind: fn<[clone: SpiderNumberType.i32, source: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),

    catnip_edge_hat_poll: fn<[target: SpiderNumberType.i32, key: SpiderNumberType.i32, predicate: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_edge_hat_clear_all: fn<[runtime: SpiderNumberType.i32]>
        ([SpiderNumberType.i32], undefined),
    catnip_runtime_reset_timer: fn<[runtime: SpiderNumberType.i32]>
        ([SpiderNumberType.i32], undefined),

    catnip_thread_new: fn<[target: SpiderNumberType.i32, fnprt: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_thread_yield: fn<[thread: SpiderNumberType.i32, fnprt: SpiderNumberType.i32], undefined>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_thread_terminate: fn<[thread: SpiderNumberType.i32], undefined>
        ([SpiderNumberType.i32], undefined),
    catnip_thread_stop_all: fn<[thread: SpiderNumberType.i32], undefined>
        ([SpiderNumberType.i32], undefined),
    catnip_thread_stop_other_scripts: fn<[thread: SpiderNumberType.i32], undefined>
        ([SpiderNumberType.i32], undefined),
    catnip_thread_resize_stack: fn<[thread: SpiderNumberType.i32, extraCapacity: SpiderNumberType.i32], undefined>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),

    catnip_blockutil_debug_log: fn<[SpiderNumberType.i32]>([SpiderNumberType.i32], undefined),
    catnip_blockutil_debug_log_int: fn<[SpiderNumberType.i32]>([SpiderNumberType.i32], undefined),
    catnip_blockutil_wait_for_threads: fn<[SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_blockutil_hstring_cmp: fn<[SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_blockutil_value_cmp: fn<[SpiderNumberType.f64, SpiderNumberType.f64, runtime: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.f64, SpiderNumberType.f64, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_blockutil_value_eq: fn<[SpiderNumberType.f64, SpiderNumberType.f64, runtime: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.f64, SpiderNumberType.f64, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_blockutil_hstring_eq_strict: fn<[SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_blockutil_hstring_join: fn<[SpiderNumberType.i32, SpiderNumberType.i32, runtime: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_blockutil_hstring_length: fn<[str: SpiderNumberType.i32], SpiderNumberType.i32>([SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_blockutil_hstring_char_at: fn<[str: SpiderNumberType.i32, idx: SpiderNumberType.i32, runtime: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_blockutil_hstring_contains: fn<[str: SpiderNumberType.i32, contains: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_blockutil_hstring_to_argb: fn<[str: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_blockutil_pen_update_thsv: fn<[target: SpiderNumberType.i32]>([SpiderNumberType.i32], undefined),
    catnip_blockutil_pen_update_argb: fn<[target: SpiderNumberType.i32]>([SpiderNumberType.i32], undefined),
    catnip_blockutil_pen_down: fn<[target: SpiderNumberType.i32]>([SpiderNumberType.i32], undefined),
    catnip_blockutil_list_push: fn<[item: SpiderNumberType.f64, list: SpiderNumberType.i32]>
        ([SpiderNumberType.f64, SpiderNumberType.i32], undefined),
    catnip_blockutil_list_delete_at: fn<[index: SpiderNumberType.i32, list: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_blockutil_list_insert_at: fn<[index: SpiderNumberType.i32, value: SpiderNumberType.f64, list: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.f64, SpiderNumberType.i32], undefined),
    catnip_blockutil_list_index_of: fn<[value: SpiderNumberType.f64, list: SpiderNumberType.i32, runtime: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.f64, SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_blockutil_costume_set: fn<[costumeString: SpiderNumberType.i32, target: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_blockutil_operator_random: fn<[a: SpiderNumberType.f64, b: SpiderNumberType.f64, runtime: SpiderNumberType.i32], SpiderNumberType.f64>
        ([SpiderNumberType.f64, SpiderNumberType.f64, SpiderNumberType.i32], SpiderNumberType.f64),

    catnip_list_new: fn<[itemSize: SpiderNumberType.i32, capacity: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.i32, SpiderNumberType.i32], SpiderNumberType.i32),

    catnip_math_fmod: fn<[a: SpiderNumberType.f64, b: SpiderNumberType.f64], SpiderNumberType.f64>
        ([SpiderNumberType.f64, SpiderNumberType.f64], SpiderNumberType.f64),
    catnip_math_round: fn<[SpiderNumberType.f64], SpiderNumberType.f64>([SpiderNumberType.f64], SpiderNumberType.f64),
    catnip_math_log: fn<[SpiderNumberType.f64], SpiderNumberType.f64>([SpiderNumberType.f64], SpiderNumberType.f64),
    catnip_math_exp: fn<[SpiderNumberType.f64], SpiderNumberType.f64>([SpiderNumberType.f64], SpiderNumberType.f64),
    catnip_math_pow: fn<[SpiderNumberType.f64, SpiderNumberType.f64], SpiderNumberType.f64>
        ([SpiderNumberType.f64, SpiderNumberType.f64], SpiderNumberType.f64),
    catnip_math_sin: fn<[SpiderNumberType.f64], SpiderNumberType.f64>([SpiderNumberType.f64], SpiderNumberType.f64),
    catnip_math_cos: fn<[SpiderNumberType.f64], SpiderNumberType.f64>([SpiderNumberType.f64], SpiderNumberType.f64),
    catnip_math_tan: fn<[SpiderNumberType.f64], SpiderNumberType.f64>([SpiderNumberType.f64], SpiderNumberType.f64),
    catnip_math_atan: fn<[SpiderNumberType.f64], SpiderNumberType.f64>([SpiderNumberType.f64], SpiderNumberType.f64),

    catnip_io_is_key_pressed: fn<[keyCode: SpiderNumberType.f64, rt: SpiderNumberType.i32], SpiderNumberType.i32>
        ([SpiderNumberType.f64, SpiderNumberType.i32], SpiderNumberType.i32),
    catnip_io_key_pressed: fn<[rt: SpiderNumberType.i32, keyCode: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_io_key_released: fn<[rt: SpiderNumberType.i32, keyCode: SpiderNumberType.i32]>
        ([SpiderNumberType.i32, SpiderNumberType.i32], undefined),
    catnip_io_mouse_move: fn<[rt: SpiderNumberType.i32, x: SpiderNumberType.f64, y: SpiderNumberType.f64]>
        ([SpiderNumberType.i32, SpiderNumberType.f64, SpiderNumberType.f64], undefined),
    catnip_io_mouse_down: fn<[rt: SpiderNumberType.i32]>([SpiderNumberType.i32], undefined),
    catnip_io_mouse_up: fn<[rt: SpiderNumberType.i32]>([SpiderNumberType.i32], undefined),
};

export type CatnipRuntimeModuleFunctionName = keyof typeof CatnipRuntimeModuleFunctions;

type MapSpiderTypeArray<T> = {
    [Key in keyof T]: MapSpiderType<T[Key]>
};

type MapSpiderType<T> =
    T extends typeof SpiderNumberType.f32 ? number :
    T extends typeof SpiderNumberType.f64 ? number :
    T extends typeof SpiderNumberType.i32 ? number :
    T extends typeof SpiderNumberType.i64 ? number :
    undefined extends T ? void :
    never;

export type CatnipRuntimeModuleFunctionExport<
    TModuleFn extends CatnipRuntimeModuleFunction<any, any>
> = (...args: TModuleFn extends CatnipRuntimeModuleFunction<any, infer TArgs> ? MapSpiderTypeArray<TArgs> : never) =>
        TModuleFn extends CatnipRuntimeModuleFunction<infer TResult, any> ? MapSpiderType<TResult> : never;

export type CatnipRuntimeModuleFunctionsObject = {
    [Key in keyof typeof CatnipRuntimeModuleFunctions]: CatnipRuntimeModuleFunctionExport<typeof CatnipRuntimeModuleFunctions[Key]>;
}
