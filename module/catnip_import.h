
#ifndef CATNIP_EXTERNAL_H_INCLUDED
#define CATNIP_EXTERNAL_H_INCLUDED

#include "./catnip.h"

void CATNIP_IMPORT(catnip_import_log)(const catnip_wchar_t *str_ptr, catnip_ui32_t str_length);
void CATNIP_IMPORT(catnip_import_render_pen_draw_lines)(const catnip_pen_line *lines, catnip_ui32_t line_length);
catnip_hstring *CATNIP_IMPORT(catnip_import_get_canon_string)(const catnip_wchar_t *str, catnip_ui32_t str_length);
catnip_ui64_t CATNIP_IMPORT(catnip_import_time)();
/* "ask and wait" prompt: show puts the question up in the host UI, hide
   takes it down (no question left to answer). */
void CATNIP_IMPORT(catnip_import_ask_show)(const catnip_wchar_t *str_ptr, catnip_ui32_t str_length);
void CATNIP_IMPORT(catnip_import_ask_hide)();
/** Milliseconds from a monotonic clock, used for scheduling. Cheap enough to
 * call from generated code, unlike the absolute wall clock. */
catnip_f64_t CATNIP_IMPORT(catnip_import_perf_time)();

/* sensing touch queries (touching / touchingcolor / coloristouchingcolor).
   The CPU silhouettes need costume pixel data the wasm side has no way to
   decode, so the host answers all three: the option strings ("_mouse_",
   "_edge_", a sprite name) and the Scratch color literals stay as UTF-16. */
catnip_bool_t CATNIP_IMPORT(catnip_import_touching)(const catnip_target *self, const catnip_wchar_t *option_ptr, catnip_ui32_t option_length);
catnip_bool_t CATNIP_IMPORT(catnip_import_touching_color)(const catnip_target *self, const catnip_wchar_t *color_ptr, catnip_ui32_t color_length);
catnip_bool_t CATNIP_IMPORT(catnip_import_color_touching_color)(const catnip_target *self, const catnip_wchar_t *color_ptr, catnip_ui32_t color_length, const catnip_wchar_t *mask_ptr, catnip_ui32_t mask_length);

#endif