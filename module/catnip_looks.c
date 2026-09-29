#include "./catnip_looks.h"
#include "./catnip_blockutil.h"

/* Looks helpers -------------------------------------------------------- */

catnip_target *catnip_looks_stage(catnip_runtime *runtime) {
  for (catnip_target *t = runtime->targets; t != 0; t = t->next_global) {
    if (t->flags & CATNIP_TARGET_FLAG_IS_STAGE)
      return t;
  }

  return 0;
}

void catnip_looks_set_visible(catnip_target *target, catnip_bool_t visible) {
  /* RenderedTarget.setVisible returns early for the stage. */
  if (target->flags & CATNIP_TARGET_FLAG_IS_STAGE) return;

  if (visible) {
    target->flags |= CATNIP_TARGET_FLAG_IS_VISIBLE;
  } else {
    target->flags &= ~CATNIP_TARGET_FLAG_IS_VISIBLE;
  }
}

/* RenderedTarget.setSize's clamp, in stage units: the scale may shrink the
   costume no further than 5px on either axis and grow it no beyond 1.5 stage
   sizes. Costumes that were never measured (natural size 0) skip the clamp —
   they would divide by zero. */
void catnip_looks_set_size(catnip_target *target, catnip_f64_t size) {
  /* RenderedTarget.setSize returns early for the stage. */
  if (target->flags & CATNIP_TARGET_FLAG_IS_STAGE) return;

  if (target->sprite->costume_count == 0) {
    target->size = size;
    return;
  }

  catnip_costume *costume = &target->sprite->costumes[target->costume];
  catnip_f64_t orig_w = costume->natural_width;
  catnip_f64_t orig_h = costume->natural_height;

  if (orig_w <= 0 || orig_h <= 0) {
    target->size = size;
    return;
  }

  catnip_f64_t min_scale = 5.0 / orig_w;
  if (5.0 / orig_h > min_scale) min_scale = 5.0 / orig_h;
  if (min_scale > 1.0) min_scale = 1.0;

  catnip_f64_t max_scale = (1.5 * 480.0) / orig_w;
  catnip_f64_t max_scale_h = (1.5 * 720.0) / orig_h;
  if (max_scale_h < max_scale) max_scale = max_scale_h;

  catnip_f64_t scale = size / 100.0;
  if (scale < min_scale) scale = min_scale;
  if (scale > max_scale) scale = max_scale;

  target->size = scale * 100.0;
}

void catnip_looks_change_size(catnip_target *target, catnip_f64_t delta) {
  catnip_looks_set_size(target, target->size + delta);
}

catnip_f64_t catnip_looks_get_size(catnip_target *target) {
  /* scratch: Math.round(util.target.size). Size is clamped positive, so a
     half-away round matches JS Math.round for every reachable value. */
  return catnip_math_round(target->size);
}

/* The seven effect members of struct catnip_target, indexed like
   CATNIP_EFFECT_*. Addressing them one by one keeps this type-safe instead
   of doing out-of-bounds arithmetic on &effect_color. */
static catnip_f64_t *effect_slot(catnip_target *target, catnip_i32_t effect) {
  catnip_f64_t *slots[7] = {
    &target->effect_color,
    &target->effect_fisheye,
    &target->effect_whirl,
    &target->effect_pixelate,
    &target->effect_mosaic,
    &target->effect_brightness,
    &target->effect_ghost
  };

  return slots[effect];
}

void catnip_looks_set_effect(catnip_target *target, catnip_i32_t effect, catnip_f64_t value) {
  if (effect < CATNIP_EFFECT_COLOR || effect > CATNIP_EFFECT_GHOST) return;

  switch (effect) {
  case CATNIP_EFFECT_BRIGHTNESS:
    if (value < -100) value = -100;
    if (value > 100) value = 100;
    break;
  case CATNIP_EFFECT_GHOST:
    if (value < 0) value = 0;
    if (value > 100) value = 100;
    break;
  }

  *effect_slot(target, effect) = value;
}

void catnip_looks_change_effect(catnip_target *target, catnip_i32_t effect, catnip_f64_t delta) {
  if (effect < CATNIP_EFFECT_COLOR || effect > CATNIP_EFFECT_GHOST) return;

  catnip_looks_set_effect(target, effect, delta + *effect_slot(target, effect));
}

void catnip_looks_clear_effects(catnip_target *target) {
  for (catnip_i32_t i = CATNIP_EFFECT_COLOR; i <= CATNIP_EFFECT_GHOST; i++)
    *effect_slot(target, i) = 0;
}

void catnip_looks_next_costume(catnip_target *target) {
  if (target->sprite->costume_count == 0) return;

  target->costume = (target->costume + 1) % target->sprite->costume_count;
}

void catnip_looks_backdrop_set(catnip_runtime *runtime, catnip_hstring *backdrop) {
  catnip_target *stage = catnip_looks_stage(runtime);
  if (stage == 0) return;

  catnip_blockutil_costume_set(stage, backdrop);
}

void catnip_looks_next_backdrop(catnip_runtime *runtime) {
  catnip_target *stage = catnip_looks_stage(runtime);
  if (stage == 0) return;

  catnip_looks_next_costume(stage);
}

catnip_f64_t catnip_looks_backdrop_number(catnip_runtime *runtime) {
  catnip_target *stage = catnip_looks_stage(runtime);
  if (stage == 0) return 1;

  /* scratch: currentCostume + 1 */
  return (catnip_f64_t) stage->costume + 1;
}

catnip_hstring *catnip_looks_backdrop_name(catnip_runtime *runtime) {
  catnip_target *stage = catnip_looks_stage(runtime);
  if (stage == 0 || stage->sprite->costume_count == 0) return 0;

  return stage->sprite->costumes[stage->costume].name;
}

/* Layer ops ------------------------------------------------------------- */

static catnip_bool_t looks_is_sprite(catnip_target *target) {
  return (target->flags & CATNIP_TARGET_FLAG_IS_STAGE) == 0;
}

static catnip_i32_t looks_layer_count(catnip_runtime *runtime) {
  catnip_i32_t count = 0;
  for (catnip_target *t = runtime->targets; t != 0; t = t->next_global)
    if (looks_is_sprite(t)) count++;
  return count;
}

/* Position of `target` among sprites (0 = rearmost), by layer_rank. */
static catnip_i32_t looks_layer_position(catnip_target *target) {
  catnip_i32_t pos = 0;
  for (catnip_target *t = target->runtime->targets; t != 0; t = t->next_global)
    if (looks_is_sprite(t) && t != target && t->layer_rank < target->layer_rank)
      pos++;
  return pos;
}

/* Moves `target` to position `new_pos` (0 = rearmost sprite): sprites are
   sorted by layer_rank, the mover is taken out and re-inserted with shift
   semantics — the same splice scratch-render's setDrawableOrder performs —
   then every sprite's rank is renumbered 1..n (the stage keeps its json 0)
   and the mover's layer_gen bumps so frame() tells the renderer. Positions
   outside [0, n-1] clamp, like the renderer clamps its splice index. */
static void looks_layer_move(catnip_target *target, catnip_i32_t new_pos) {
  catnip_runtime *runtime = target->runtime;
  catnip_i32_t count = looks_layer_count(runtime);
  if (count == 0) return;

  catnip_target *sorted[count];
  catnip_i32_t n = 0;

  for (catnip_target *t = runtime->targets; t != 0; t = t->next_global)
    if (looks_is_sprite(t)) sorted[n++] = t;

  /* Insertion sort by rank; json layer ranks are distinct, ties keep the
     scan order. */
  for (catnip_i32_t i = 1; i < n; i++) {
    catnip_target *v = sorted[i];
    catnip_i32_t j = i - 1;
    while (j >= 0 && sorted[j]->layer_rank > v->layer_rank) {
      sorted[j + 1] = sorted[j];
      j--;
    }
    sorted[j + 1] = v;
  }

  catnip_i32_t my_pos = 0;
  while (my_pos < n && sorted[my_pos] != target) my_pos++;
  if (my_pos >= n) return;

  if (new_pos < 0) new_pos = 0;
  if (new_pos >= n) new_pos = n - 1;

  catnip_target *moved = sorted[my_pos];
  if (new_pos < my_pos) {
    for (catnip_i32_t i = my_pos; i > new_pos; i--) sorted[i] = sorted[i - 1];
  } else if (new_pos > my_pos) {
    for (catnip_i32_t i = my_pos; i < new_pos; i++) sorted[i] = sorted[i + 1];
  }
  sorted[new_pos] = moved;

  for (catnip_i32_t i = 0; i < n; i++) sorted[i]->layer_rank = i + 1;
  target->layer_gen++;
}

void catnip_looks_goto_front(catnip_target *target) {
  /* RenderedTarget's layer ops are sprites-only; the stage ignores them. */
  if (!looks_is_sprite(target)) return;

  looks_layer_move(target, 0x7fffffff);
}

void catnip_looks_goto_back(catnip_target *target) {
  if (!looks_is_sprite(target)) return;

  looks_layer_move(target, 0);
}

void catnip_looks_change_layer(catnip_target *target, catnip_f64_t n) {
  if (!looks_is_sprite(target)) return;

  /* Scratch hands the count straight to the renderer: JS ToInteger turns NaN
     into 0 and truncates toward zero, and the splice clamps to the list
     bounds — replicate both so nothing reaches wasm's trapping cast. */
  if (n != n) n = 0;
  if (n > 1e9) n = 1e9;
  if (n < -1e9) n = -1e9;

  looks_layer_move(target, looks_layer_position(target) + (catnip_i32_t)n);
}

/* clone creation: RenderedTarget.goBehindOther puts the new clone straight
   behind the target it was cloned from (setDrawableOrder splice), which is
   a move to the source's slot — everyone from the source forward shifts up
   one and the mover's layer_gen bumps so frame() re-sorts. The clone is
   parked at the front of the order first, so its temporary rank cannot tie
   with anything already in it. */
void catnip_looks_go_behind(catnip_target *clone, catnip_target *source) {
  if (!looks_is_sprite(clone) || !looks_is_sprite(source)) return;

  clone->layer_rank = 0x7fffffff;
  looks_layer_move(clone, looks_layer_position(source));
}

/* Say/think bubbles ---------------------------------------------------- */

/* Scratch3LooksBlocks.SAY_BUBBLE_LIMIT. */
#define CATNIP_BUBBLE_TEXT_LIMIT 330

void catnip_looks_say(catnip_hstring *text, catnip_ui32_t type, catnip_target *target) {
  /* _updateBubble('') clears the bubble but still bumps the usage id —
     here the generation counter — which cancels a pending sayforsecs
     clear, exactly like Scratch's usageId comparison. */
  if (text == CATNIP_NULL || CATNIP_HSTRING_LENGTH(text) == 0) {
    target->bubble_text = CATNIP_NULL;
    target->bubble_type = CATNIP_BUBBLE_NONE;
    target->bubble_gen++;
    return;
  }

  if (CATNIP_HSTRING_LENGTH(text) > CATNIP_BUBBLE_TEXT_LIMIT) {
    /* JS substr(0, 330) of the formatted text. The source may be shared
       (a variable's value), so truncate into a fresh copy. */
    text = catnip_hstring_new(target->runtime, catnip_hstring_get_data(text),
                              CATNIP_BUBBLE_TEXT_LIMIT);
  }

  target->bubble_text = text;
  target->bubble_type = type;
  target->bubble_gen++;
}

void catnip_looks_clear_if_unchanged(catnip_ui32_t usage, catnip_target *target) {
  if (target->bubble_gen != usage) return;

  catnip_looks_say(CATNIP_NULL, CATNIP_BUBBLE_NONE, target);
}

catnip_hstring *catnip_looks_bubble_format(catnip_f64_t value, catnip_runtime *runtime) {
  /* _formatBubbleText: non-integers with |x| >= 0.01 display exactly two
     decimals; integers and tiny magnitudes keep the shortest round-trip
     form (JS String(number)). */
  catnip_f64_t a = value < 0 ? -value : value;

  if (a >= 0.01 && CATNIP_F64_FLOOR(value) != value) {
    catnip_ui64_t scaled = (catnip_ui64_t)(a * 100.0 + 0.5);
    catnip_ui64_t whole = scaled / 100;
    catnip_ui32_t frac = (catnip_ui32_t)(scaled % 100);

    catnip_char_t buf[32];
    catnip_i32_t n = 0;

    if (value < 0) buf[n++] = '-';

    catnip_char_t digits[24];
    catnip_i32_t d = 0;
    do {
      digits[d++] = (catnip_char_t)('0' + (whole % 10));
      whole /= 10;
    } while (whole != 0 && d < (catnip_i32_t)sizeof(digits));
    while (d > 0) buf[n++] = digits[--d];

    buf[n++] = '.';
    buf[n++] = (catnip_char_t)('0' + (frac / 10));
    buf[n++] = (catnip_char_t)('0' + (frac % 10));

    return catnip_hstring_new_from_ascii(runtime, buf, (catnip_ui32_t)n);
  }

  return catnip_numconv_stringify_f64(runtime, value);
}
