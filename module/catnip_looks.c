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
