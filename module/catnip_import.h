
#ifndef CATNIP_EXTERNAL_H_INCLUDED
#define CATNIP_EXTERNAL_H_INCLUDED

#include "./catnip.h"

void CATNIP_IMPORT(catnip_import_log)(const catnip_wchar_t *str_ptr, catnip_ui32_t str_length);
void CATNIP_IMPORT(catnip_import_render_pen_draw_lines)(const catnip_pen_line *lines, catnip_ui32_t line_length);
catnip_hstring *CATNIP_IMPORT(catnip_import_get_canon_string)(const catnip_wchar_t *str, catnip_ui32_t str_length);
catnip_ui64_t CATNIP_IMPORT(catnip_import_time)();
/** Milliseconds from a monotonic clock, used for scheduling. Cheap enough to
 * call from generated code, unlike the absolute wall clock. */
catnip_f64_t CATNIP_IMPORT(catnip_import_perf_time)();

#endif