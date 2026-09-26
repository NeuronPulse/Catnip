
#include "./catnip_io.h"

// Not a key code: a query for "any" key at all, and an answer of "this is not
// a key" (scratch-vm's keyboard reports the second as "not pressed").
#define CATNIP_KEY_CODE_ANY 256
#define CATNIP_KEY_CODE_NONE -1

static catnip_bool_t hstring_equals_ascii(const catnip_hstring *str, const catnip_char_t *cstr) {
  const catnip_ui32_t length = CATNIP_HSTRING_LENGTH(str);
  const catnip_wchar_t *data = catnip_hstring_get_data(str);

  for (catnip_ui32_t i = 0; i < length; ++i) {
    if (cstr[i] == '\0' || (catnip_ui32_t) cstr[i] != (catnip_ui32_t) data[i])
      return CATNIP_FALSE;
  }

  return cstr[length] == '\0';
}

// The one character of a string that scratch-vm would read as a key, or
// CATNIP_KEY_CODE_NONE when it is not a key we can hold.
static catnip_i32_t key_code_of_first_char(const catnip_hstring *keyString) {
  if (CATNIP_HSTRING_LENGTH(keyString) == 0) return CATNIP_KEY_CODE_NONE;

  catnip_wchar_t firstChar = catnip_hstring_get_data(keyString)[0];

  if (firstChar >= 'a' && firstChar <= 'z') firstChar -= 'a' - 'A';

  if (firstChar < 32 || firstChar > 126) return CATNIP_KEY_CODE_NONE;

  return firstChar;
}

// Mirrors Keyboard._keyArgToScratchKey in scratch-vm: a number in the ASCII
// range is itself, a number in the arrow or space range is that key, a key
// name is that key, and anything else is its first character upper-cased.
//
// Catnip's key table holds one byte per key, so only the ASCII keys are
// tracked; the non-English letters scratch-vm would accept have no code here.
static catnip_i32_t get_key_code(catnip_runtime *runtime, catnip_value key) {

  if (CATNIP_VALUE_IS_STRING(key)) {
    catnip_hstring *keyName = CATNIP_VALUE_AS_STRING(key);

    if (hstring_equals_ascii(keyName, "any")) return CATNIP_KEY_CODE_ANY;
    if (hstring_equals_ascii(keyName, "space")) return 32;
    if (hstring_equals_ascii(keyName, "left arrow")) return 37;
    if (hstring_equals_ascii(keyName, "up arrow")) return 38;
    if (hstring_equals_ascii(keyName, "right arrow")) return 39;
    if (hstring_equals_ascii(keyName, "down arrow")) return 40;
    if (hstring_equals_ascii(keyName, "enter")) return 13;

    return key_code_of_first_char(keyName);
  }

  catnip_f64_t keyCode = CATNIP_VALUE_AS_NUMBER(key);

  if (keyCode >= 48 && keyCode <= 90) return (catnip_i32_t) keyCode;

  switch ((catnip_i32_t) keyCode) {
    case 32: return 32;
    case 37: return 37;
    case 38: return 38;
    case 39: return 39;
    case 40: return 40;
  }

  // Anything else is read as its first character, so the number keys ("0" ..
  // "9") become the numbers themselves, which are out of the range above.
  // The string is left for the collector, as everywhere else.
  catnip_hstring *keyName = catnip_numconv_stringify_f64(runtime, keyCode);

  return key_code_of_first_char(keyName);
}

catnip_bool_t catnip_io_is_key_pressed(catnip_runtime *runtime, catnip_value key) {

  catnip_i32_t keyCode = get_key_code(runtime, key);

  if (keyCode == CATNIP_KEY_CODE_ANY) return runtime->io->key_down_count != 0;
  if (keyCode == CATNIP_KEY_CODE_NONE) return CATNIP_FALSE;

  CATNIP_ASSERT(keyCode >= 0 && keyCode < 256);

  return runtime->io->keys[keyCode];
}

void catnip_io_key_pressed(catnip_runtime *runtime, catnip_ui32_t charCode) {
  CATNIP_ASSERT(charCode < 256);

  catnip_uchar_t *keyPtr = &runtime->io->keys[charCode];

  if (*keyPtr) return;

  ++runtime->io->key_down_count;
  *keyPtr = 1;

}

void catnip_io_key_released(catnip_runtime *runtime, catnip_ui32_t charCode) {
  CATNIP_ASSERT(charCode >= 0 && charCode < 256);

  catnip_uchar_t *keyPtr = &runtime->io->keys[charCode];

  if (!*keyPtr) return;

  --runtime->io->key_down_count;
  *keyPtr = 0;
}

void catnip_io_mouse_move(catnip_runtime *runtime, catnip_f64_t x, catnip_f64_t y) {
  runtime->io->mouse_x = x;
  runtime->io->mouse_y = y;
} 

void catnip_io_mouse_down(catnip_runtime *runtime) {
  runtime->io->mouse_down = CATNIP_TRUE;
}

void catnip_io_mouse_up(catnip_runtime *runtime) {
  runtime->io->mouse_down = CATNIP_FALSE;
}