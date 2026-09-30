
#include "./catnip.h"
#include "./catnip_motion.h"
#include "./catnip_looks.h"
#include "./catnip_clone.h"
#include "./catnip_sensing.h"

void CATNIP_EXPORT(catnip_init)() {
  catnip_strings_init();
}

void *CATNIP_EXPORT(catnip_mem_alloc)(catnip_ui32_t length, catnip_bool_t zero) {
  void *ptr = catnip_mem_alloc(length);
  if (zero)
    catnip_mem_zero(ptr, length);
  return ptr;
}

void CATNIP_EXPORT(catnip_mem_free)(void *ptr) {
  catnip_mem_free(ptr);
}

catnip_hstring *CATNIP_EXPORT(catnip_numconv_stringify_f64)(catnip_f64_t value, catnip_runtime *runtime) {
  return catnip_numconv_stringify_f64(runtime, value);
}

catnip_f64_t CATNIP_EXPORT(catnip_numconv_parse)(catnip_hstring *str, catnip_runtime *runtime) {
  return catnip_numconv_parse(runtime, str);
}


catnip_runtime *CATNIP_EXPORT(catnip_runtime_new)() {
  return catnip_runtime_new();
}

void CATNIP_EXPORT(catnip_runtime_tick)(catnip_runtime *runtime) {
  catnip_runtime_tick(runtime);
}

catnip_bool_t CATNIP_EXPORT(catnip_runtime_warp_expired)(catnip_runtime *runtime) {
  return catnip_runtime_warp_expired(runtime);
}

void CATNIP_EXPORT(catnip_runtime_start_threads)(catnip_runtime *runtime, catnip_sprite *sprite, catnip_thread_fnptr entrypoint, catnip_list *threadList) {
  return catnip_runtime_start_threads(runtime, sprite, entrypoint, threadList);
}

void CATNIP_EXPORT(catnip_runtime_render_pen_flush)(catnip_runtime *runtime) {
  catnip_runtime_render_pen_flush(runtime);
}

catnip_hstring *CATNIP_EXPORT(catnip_runtime_new_hstring)(catnip_runtime *runtime, catnip_ui32_t length) {
  return catnip_hstring_new_simple(runtime, length);
}


catnip_target *CATNIP_EXPORT(catnip_target_new)(catnip_runtime *runtime, catnip_sprite *sprite) {
  return catnip_target_new(runtime, sprite);
}

void CATNIP_EXPORT(catnip_target_start_thread)(catnip_target *target, catnip_thread_fnptr entrypoint, catnip_list *threadList, catnip_ui32_t mode) {
  catnip_target_start_thread(target, entrypoint, threadList, mode);
}

void CATNIP_EXPORT(catnip_target_set_xy)(catnip_f64_t x, catnip_f64_t y, catnip_target *target) {
  catnip_target_set_xy(target, x, y);
}


catnip_thread *CATNIP_EXPORT(catnip_thread_new)(catnip_target *target, catnip_thread_fnptr fnptr) {
  return catnip_thread_new(target, fnptr);
}

void CATNIP_EXPORT(catnip_thread_yield)(catnip_thread *thread, catnip_thread_fnptr fnptr) {
  return catnip_thread_yield(thread, fnptr);
}

void CATNIP_EXPORT(catnip_thread_terminate)(catnip_thread *thread) {
  return catnip_thread_terminate(thread);
}

void CATNIP_EXPORT(catnip_thread_stop_all)(catnip_thread *thread) {
  return catnip_thread_stop_all(thread);
}

void CATNIP_EXPORT(catnip_thread_stop_other_scripts)(catnip_thread *thread) {
  return catnip_thread_stop_other_scripts(thread);
}


void CATNIP_EXPORT(catnip_blockutil_debug_log)(catnip_hstring *str) {
  catnip_blockutil_debug_log(str);
}

void CATNIP_EXPORT(catnip_blockutil_debug_log_int)(catnip_ui32_t x) {
  catnip_blockutil_debug_log_int(x);
}

catnip_thread_status CATNIP_EXPORT(catnip_blockutil_wait_for_threads)(catnip_list *threadList) {
  return catnip_blockutil_wait_for_threads(threadList);
}

catnip_i32_t CATNIP_EXPORT(catnip_blockutil_hstring_cmp)(catnip_hstring *a, catnip_hstring *b) {
  return catnip_blockutil_hstring_cmp(a, b);
}

catnip_i32_t CATNIP_EXPORT(catnip_blockutil_value_cmp)(catnip_f64_t a, catnip_f64_t b, catnip_runtime *runtime) {
  return catnip_blockutil_value_cmp(runtime, CATNIP_VALUE_FROM_F64(a), CATNIP_VALUE_FROM_F64(b));
}

catnip_bool_t CATNIP_EXPORT(catnip_blockutil_value_eq)(catnip_f64_t a, catnip_f64_t b, catnip_runtime *runtime) {
  return catnip_blockutil_value_eq(runtime, CATNIP_VALUE_FROM_F64(a), CATNIP_VALUE_FROM_F64(b));
}

catnip_bool_t CATNIP_EXPORT(catnip_blockutil_hstring_eq_strict)(const catnip_hstring *a, const catnip_hstring *b) {
  return catnip_hstring_equal(a, b);
}

catnip_hstring *CATNIP_EXPORT(catnip_blockutil_hstring_join)(const catnip_hstring *a, const catnip_hstring *b, catnip_runtime *runtime) {
  return catnip_blockutil_hstring_join(runtime, a, b);
}

catnip_ui32_t CATNIP_EXPORT(catnip_blockutil_hstring_length)(catnip_hstring *str) {
  return catnip_blockutil_hstring_length(str);
}

catnip_hstring *CATNIP_EXPORT(catnip_blockutil_hstring_char_at)(catnip_hstring *str, catnip_ui32_t index, catnip_runtime *runtime) {
  return catnip_blockutil_hstring_char_at(runtime, str, index);
}

catnip_bool_t CATNIP_EXPORT(catnip_blockutil_hstring_contains)(catnip_hstring *str, catnip_hstring *contains) {
  return catnip_blockutil_hstring_contains(str, contains);
}

catnip_ui32_t CATNIP_EXPORT(catnip_blockutil_hstring_to_argb)(const catnip_hstring *str) {
  return catnip_blockutil_hstring_to_argb(str);
}


void CATNIP_EXPORT(catnip_blockutil_pen_update_thsv)(catnip_target *target) {
  catnip_blockutil_pen_update_thsv(target);
}

void CATNIP_EXPORT(catnip_blockutil_pen_update_argb)(catnip_target *target) {
  catnip_blockutil_pen_update_argb(target);
}

void CATNIP_EXPORT(catnip_blockutil_pen_down)(catnip_target *thread) {
  catnip_blockutil_pen_down(thread);
}

void CATNIP_EXPORT(catnip_blockutil_list_push)(catnip_f64_t value, catnip_list *list) {
  catnip_blockutil_list_push(list, (catnip_value) value);
}

void CATNIP_EXPORT(catnip_blockutil_list_delete_at)(catnip_i32_t index, catnip_list *list) {
  catnip_blockutil_list_delete_at(list, index);
}

void CATNIP_EXPORT(catnip_blockutil_list_insert_at)(catnip_i32_t index, catnip_f64_t value, catnip_list *list) {
  catnip_blockutil_list_insert_at(list, index, (catnip_value) value);
}

catnip_ui32_t CATNIP_EXPORT(catnip_blockutil_list_index_of)(catnip_f64_t value, catnip_list *list, catnip_runtime *runtime) {
  return catnip_blockutil_list_index_of(runtime, list, (catnip_value) value);
}

void CATNIP_EXPORT(catnip_blockutil_costume_set)(catnip_hstring *costume, catnip_target *target) {
  catnip_blockutil_costume_set(target, costume);
}

catnip_f64_t CATNIP_EXPORT(catnip_blockutil_operator_random)(catnip_f64_t a, catnip_f64_t b, catnip_runtime *runtime) {
  return catnip_blockutil_operator_random(runtime, (catnip_value) a, (catnip_value) b);
}


void CATNIP_EXPORT(catnip_thread_resize_stack)(catnip_thread *thread, catnip_ui32_t extraCapacity) {
  catnip_thread_resize_stack(thread, extraCapacity);
}


catnip_list *CATNIP_EXPORT(catnip_list_new)(catnip_ui32_t item_size, catnip_ui32_t capacity) {
  return catnip_list_new(item_size, capacity);
}


catnip_f64_t CATNIP_EXPORT(catnip_math_fmod)(catnip_f64_t x, catnip_f64_t y) {
  return catnip_math_fmod(x, y);
}

catnip_f64_t CATNIP_EXPORT(catnip_math_round)(catnip_f64_t n) {
  return catnip_math_round(n);
}

catnip_f64_t CATNIP_EXPORT(catnip_math_log)(catnip_f64_t x) {
  return catnip_math_log(x);
}

catnip_f64_t CATNIP_EXPORT(catnip_math_exp)(catnip_f64_t x) {
  return catnip_math_exp(x);
}

catnip_f64_t CATNIP_EXPORT(catnip_math_pow)(catnip_f64_t x, catnip_f64_t y) {
  return catnip_math_pow(x, y);
}

catnip_f64_t CATNIP_EXPORT(catnip_math_sin)(catnip_f64_t x) {
  return catnip_math_round(catnip_math_sin((CATNIP_F64_PI * x) / 180) * 1e10) / 1e10;
}

catnip_f64_t CATNIP_EXPORT(catnip_math_cos)(catnip_f64_t x) {
  return catnip_math_round(catnip_math_cos((CATNIP_F64_PI * x) / 180) * 1e10) / 1e10;
}

catnip_f64_t CATNIP_EXPORT(catnip_math_tan)(catnip_f64_t x) {
  x = catnip_math_fmod(x, 360);
  if (x == -270 || x == 90) return CATNIP_F64_INFINITY;
  if (x == 270 || x == -90) return -CATNIP_F64_INFINITY;
  return catnip_math_round(catnip_math_tan((CATNIP_F64_PI * x) / 180) * 1e10) / 1e10;
}

catnip_f64_t CATNIP_EXPORT(catnip_math_atan)(catnip_f64_t x) {
  return catnip_math_atan(x) * 180 / CATNIP_F64_PI;
}


catnip_bool_t CATNIP_EXPORT(catnip_io_is_key_pressed)(catnip_f64_t key, catnip_runtime *runtime) {
  return catnip_io_is_key_pressed(runtime, (catnip_value) key);
}

void CATNIP_EXPORT(catnip_io_key_pressed)(catnip_runtime *runtime, catnip_ui32_t keyCode) {
  catnip_io_key_pressed(runtime, keyCode);
}

void CATNIP_EXPORT(catnip_io_key_released)(catnip_runtime *runtime, catnip_ui32_t keyCode) {
  catnip_io_key_released(runtime, keyCode);
}

void CATNIP_EXPORT(catnip_io_mouse_move)(catnip_runtime *runtime, catnip_f64_t x, catnip_f64_t y) {
  catnip_io_mouse_move(runtime, x, y);
}

void CATNIP_EXPORT(catnip_io_mouse_down)(catnip_runtime *runtime) {
  catnip_io_mouse_down(runtime);
}

void CATNIP_EXPORT(catnip_io_mouse_up)(catnip_runtime *runtime) {
  catnip_io_mouse_up(runtime);
}
/* Motion ----------------------------------------------------------------
   Exports take the block's operands first and the current target last, the
   order the compiler pushes them. */

void CATNIP_EXPORT(catnip_motion_movesteps)(catnip_f64_t steps, catnip_target *target) {
  catnip_motion_movesteps(target, steps);
}

void CATNIP_EXPORT(catnip_motion_turnright)(catnip_f64_t degrees, catnip_target *target) {
  catnip_motion_turnright(target, degrees);
}

void CATNIP_EXPORT(catnip_motion_turnleft)(catnip_f64_t degrees, catnip_target *target) {
  catnip_motion_turnleft(target, degrees);
}

void CATNIP_EXPORT(catnip_motion_point_direction)(catnip_f64_t direction, catnip_target *target) {
  catnip_motion_point_direction(target, direction);
}

void CATNIP_EXPORT(catnip_motion_point_towards)(catnip_hstring *towards, catnip_target *target) {
  catnip_motion_point_towards(target, towards);
}

void CATNIP_EXPORT(catnip_motion_goto)(catnip_hstring *to, catnip_target *target) {
  catnip_motion_goto(target, to);
}

void CATNIP_EXPORT(catnip_motion_bounce)(catnip_target *target) {
  catnip_motion_bounce(target);
}

void CATNIP_EXPORT(catnip_motion_set_rotation_style)(catnip_hstring *style, catnip_target *target) {
  catnip_motion_set_rotation_style(target, style);
}

void CATNIP_EXPORT(catnip_motion_glide_begin_xy)(catnip_f64_t x, catnip_f64_t y, catnip_f64_t secs, catnip_target *target) {
  catnip_motion_glide_begin_xy(target, x, y, secs);
}

void CATNIP_EXPORT(catnip_motion_glide_begin_to)(catnip_hstring *to, catnip_f64_t secs, catnip_target *target) {
  catnip_motion_glide_begin_to(target, to, secs);
}

catnip_f64_t CATNIP_EXPORT(catnip_motion_glide_step)(catnip_target *target) {
  return catnip_motion_glide_step(target);
}

void CATNIP_EXPORT(catnip_looks_set_visible)(catnip_bool_t visible, catnip_target *target) {
  catnip_looks_set_visible(target, visible);
}

void CATNIP_EXPORT(catnip_looks_set_size)(catnip_f64_t size, catnip_target *target) {
  catnip_looks_set_size(target, size);
}

void CATNIP_EXPORT(catnip_looks_change_size)(catnip_f64_t delta, catnip_target *target) {
  catnip_looks_change_size(target, delta);
}

catnip_f64_t CATNIP_EXPORT(catnip_looks_get_size)(catnip_target *target) {
  return catnip_looks_get_size(target);
}

void CATNIP_EXPORT(catnip_looks_set_effect)(catnip_f64_t value, catnip_i32_t effect, catnip_target *target) {
  catnip_looks_set_effect(target, effect, value);
}

void CATNIP_EXPORT(catnip_looks_change_effect)(catnip_f64_t delta, catnip_i32_t effect, catnip_target *target) {
  catnip_looks_change_effect(target, effect, delta);
}

void CATNIP_EXPORT(catnip_looks_clear_effects)(catnip_target *target) {
  catnip_looks_clear_effects(target);
}

void CATNIP_EXPORT(catnip_looks_next_costume)(catnip_target *target) {
  catnip_looks_next_costume(target);
}

void CATNIP_EXPORT(catnip_looks_backdrop_set)(catnip_hstring *backdrop, catnip_runtime *runtime) {
  catnip_looks_backdrop_set(runtime, backdrop);
}

void CATNIP_EXPORT(catnip_looks_next_backdrop)(catnip_runtime *runtime) {
  catnip_looks_next_backdrop(runtime);
}

catnip_f64_t CATNIP_EXPORT(catnip_looks_backdrop_number)(catnip_runtime *runtime) {
  return catnip_looks_backdrop_number(runtime);
}

catnip_hstring *CATNIP_EXPORT(catnip_looks_backdrop_name)(catnip_runtime *runtime) {
  return catnip_looks_backdrop_name(runtime);
}

void CATNIP_EXPORT(catnip_looks_goto_front)(catnip_target *target) {
  catnip_looks_goto_front(target);
}

void CATNIP_EXPORT(catnip_looks_goto_back)(catnip_target *target) {
  catnip_looks_goto_back(target);
}

void CATNIP_EXPORT(catnip_looks_change_layer)(catnip_f64_t n, catnip_target *target) {
  catnip_looks_change_layer(target, n);
}

void CATNIP_EXPORT(catnip_looks_say)(catnip_hstring *text, catnip_ui32_t type, catnip_target *target) {
  catnip_looks_say(text, type, target);
}

void CATNIP_EXPORT(catnip_looks_clear_if_unchanged)(catnip_ui32_t usage, catnip_target *target) {
  catnip_looks_clear_if_unchanged(usage, target);
}

catnip_hstring *CATNIP_EXPORT(catnip_looks_bubble_format)(catnip_f64_t value, catnip_runtime *runtime) {
  return catnip_looks_bubble_format(value, runtime);
}

catnip_target *CATNIP_EXPORT(catnip_clone_resolve_source)(catnip_hstring *option, catnip_runtime *runtime, catnip_target *current) {
  return catnip_clone_resolve_source(option, runtime, current);
}

catnip_target *CATNIP_EXPORT(catnip_clone_create)(catnip_target *source) {
  return catnip_clone_create(source);
}

catnip_i32_t CATNIP_EXPORT(catnip_clone_delete)(catnip_target *target) {
  return catnip_clone_delete(target);
}

void CATNIP_EXPORT(catnip_clone_dispose_all)(catnip_runtime *runtime) {
  catnip_clone_dispose_all(runtime);
}

void CATNIP_EXPORT(catnip_looks_go_behind)(catnip_target *clone, catnip_target *source) {
  catnip_looks_go_behind(clone, source);
}

catnip_bool_t CATNIP_EXPORT(catnip_edge_hat_poll)(catnip_target *target, catnip_ui32_t key, catnip_bool_t predicate) {
  return catnip_edge_hat_poll(target, key, predicate);
}

void CATNIP_EXPORT(catnip_edge_hat_clear_all)(catnip_runtime *runtime) {
  catnip_edge_hat_clear_all(runtime);
}

void CATNIP_EXPORT(catnip_runtime_reset_timer)(catnip_runtime *runtime) {
  catnip_runtime_reset_timer(runtime);
}

catnip_ui32_t CATNIP_EXPORT(catnip_sensing_ask)(catnip_hstring *question, catnip_target *target) {
  return catnip_sensing_ask(question, target);
}

catnip_bool_t CATNIP_EXPORT(catnip_sensing_ask_done)(catnip_ui32_t ticket) {
  return catnip_sensing_ask_done(ticket);
}

void CATNIP_EXPORT(catnip_sensing_answer_set)(catnip_hstring *answer) {
  catnip_sensing_answer_set(answer);
}

catnip_hstring *CATNIP_EXPORT(catnip_sensing_answer_get)() {
  return catnip_sensing_answer_get();
}

void CATNIP_EXPORT(catnip_sensing_ask_reset)() {
  catnip_sensing_ask_reset();
}

catnip_f64_t CATNIP_EXPORT(catnip_sensing_distance_to)(const catnip_hstring *option, catnip_target *self) {
  return catnip_sensing_distance_to(option, self);
}

catnip_f64_t CATNIP_EXPORT(catnip_sensing_of)(const catnip_hstring *object, const catnip_hstring *property, catnip_target *self) {
  return catnip_sensing_of(object, property, self);
}

void CATNIP_EXPORT(catnip_sensing_set_drag_mode)(catnip_f64_t mode, catnip_target *self) {
  catnip_sensing_set_drag_mode(mode, self);
}
