#include "./catnip_motion.h"

/* Scratch-side helpers ------------------------------------------------- */

/* Compares an hstring to an ASCII literal, e.g. "_mouse_". */
static catnip_bool_t motion_is(const catnip_hstring *str, const char *cstr) {
  if (str == 0) return CATNIP_FALSE;

  catnip_wchar_t *data = catnip_hstring_get_data(str);
  catnip_ui32_t len = CATNIP_HSTRING_LENGTH(str);

  catnip_ui32_t i = 0;
  while (cstr[i] != '\0') {
    if (i >= len) return CATNIP_FALSE;
    if (data[i] != (catnip_wchar_t) cstr[i]) return CATNIP_FALSE;
    i++;
  }

  return i == len;
}

/* getSpriteTargetByName: walks every target except the stage and returns the
   first whose sprite is named `name` (scratch's runtime skips isStage).
   scratch's array lists the originals first, so clones — same sprite, same
   name — never win here; our chain is prepended, so they are skipped
   explicitly. */
static catnip_target *motion_find_target(catnip_runtime *runtime, const catnip_hstring *name) {
  for (catnip_target *t = runtime->targets; t != 0; t = t->next_global) {
    if (t->flags & CATNIP_TARGET_FLAG_IS_STAGE) continue;
    if (t->flags & CATNIP_TARGET_FLAG_IS_CLONE) continue;
    if (t->sprite->name != 0 && catnip_hstring_equal(t->sprite->name, name))
      return t;
  }

  return 0;
}

/* scratch3_motion.js getTargetXY: mouse position, a random stage position, or
   another sprite's position. Returns false for a sprite name that matches
   nothing — the caller then does nothing, like scratch's `if (targetXY)`. */
static catnip_bool_t motion_resolve_xy(catnip_target *self, const catnip_hstring *name, catnip_f64_t *out_x, catnip_f64_t *out_y) {
  if (name == 0) return CATNIP_FALSE;

  if (motion_is(name, "_mouse_")) {
    *out_x = self->runtime->io->mouse_x;
    *out_y = self->runtime->io->mouse_y;
    return CATNIP_TRUE;
  }

  if (motion_is(name, "_random_")) {
    /* round(480 * (random - 0.5)) and round(360 * (random - 0.5)); JS round
       is floor(v + 0.5) for the values this range produces. */
    *out_x = CATNIP_F64_FLOOR(catnip_math_random(self->runtime) * 480.0 - 240.0 + 0.5);
    *out_y = CATNIP_F64_FLOOR(catnip_math_random(self->runtime) * 360.0 - 180.0 + 0.5);
    return CATNIP_TRUE;
  }

  catnip_target *other = motion_find_target(self->runtime, name);
  if (other == 0) return CATNIP_FALSE;

  *out_x = other->position_x;
  *out_y = other->position_y;
  return CATNIP_TRUE;
}

/* Blocks ---------------------------------------------------------------- */

void catnip_motion_movesteps(catnip_target *target, catnip_f64_t steps) {
  catnip_f64_t radians = (90.0 - target->direction) * (CATNIP_F64_PI / 180.0);
  catnip_f64_t dx = steps * catnip_math_cos(radians);
  catnip_f64_t dy = steps * catnip_math_sin(radians);

  catnip_target_set_xy(target, target->position_x + dx, target->position_y + dy);
}

void catnip_motion_turnright(catnip_target *target, catnip_f64_t degrees) {
  catnip_target_set_direction(target, target->direction + degrees);
}

void catnip_motion_turnleft(catnip_target *target, catnip_f64_t degrees) {
  catnip_target_set_direction(target, target->direction - degrees);
}

void catnip_motion_point_direction(catnip_target *target, catnip_f64_t direction) {
  catnip_target_set_direction(target, direction);
}

void catnip_motion_point_towards(catnip_target *target, catnip_hstring *towards) {
  if (motion_is(towards, "_random_")) {
    /* round(random * 360) - 180, a direction in [-180, 180]. */
    catnip_target_set_direction(target, CATNIP_F64_FLOOR(catnip_math_random(target->runtime) * 360.0 + 0.5) - 180.0);
    return;
  }

  catnip_f64_t x, y;
  if (!motion_resolve_xy(target, towards, &x, &y)) return;

  catnip_f64_t dx = x - target->position_x;
  catnip_f64_t dy = y - target->position_y;
  catnip_f64_t direction = 90.0 - (catnip_math_atan2(dy, dx) * 180.0 / CATNIP_F64_PI);

  catnip_target_set_direction(target, direction);
}

void catnip_motion_goto(catnip_target *target, catnip_hstring *to) {
  catnip_f64_t x, y;
  if (!motion_resolve_xy(target, to, &x, &y)) return;

  catnip_target_set_xy(target, x, y);
}

void catnip_motion_bounce(catnip_target *target) {
  catnip_bounds bounds;
  catnip_target_get_bounds(target, &bounds);

  /* Distance to each edge: positive while clear, zero once past. */
  catnip_f64_t dist_left = CATNIP_MAX(0, 240.0 + bounds.left);
  catnip_f64_t dist_top = CATNIP_MAX(0, 180.0 - bounds.top);
  catnip_f64_t dist_right = CATNIP_MAX(0, 240.0 - bounds.right);
  catnip_f64_t dist_bottom = CATNIP_MAX(0, 180.0 + bounds.bottom);

  /* Nearest edge: strict < in scratch's left/top/right/bottom order, so ties
     keep the earlier edge. */
  catnip_i32_t nearest = -1;
  catnip_f64_t min_dist = CATNIP_F64_INFINITY;

  if (dist_left < min_dist) { min_dist = dist_left; nearest = 0; }
  if (dist_top < min_dist) { min_dist = dist_top; nearest = 1; }
  if (dist_right < min_dist) { min_dist = dist_right; nearest = 2; }
  if (dist_bottom < min_dist) { min_dist = dist_bottom; nearest = 3; }

  if (min_dist > 0) return; /* Not touching any edge. */

  catnip_f64_t radians = (90.0 - target->direction) * (CATNIP_F64_PI / 180.0);
  catnip_f64_t dx = catnip_math_cos(radians);
  catnip_f64_t dy = -catnip_math_sin(radians);

  if (nearest == 0) dx = CATNIP_MAX(0.2, CATNIP_F64_ABS(dx));
  else if (nearest == 1) dy = CATNIP_MAX(0.2, CATNIP_F64_ABS(dy));
  else if (nearest == 2) dx = 0 - CATNIP_MAX(0.2, CATNIP_F64_ABS(dx));
  else dy = 0 - CATNIP_MAX(0.2, CATNIP_F64_ABS(dy));

  catnip_f64_t new_direction = (catnip_math_atan2(dy, dx) * 180.0 / CATNIP_F64_PI) + 90.0;
  catnip_target_set_direction(target, new_direction);

  /* keepInFence: pull the box fully inside (no 15px slack — that is the
     renderer's fence, which setXY applies on top of this, exactly like
     scratch's `setXY(keepInFence(x, y))`). */
  catnip_target_get_bounds(target, &bounds);

  catnip_f64_t fence_dx = 0;
  catnip_f64_t fence_dy = 0;
  if (bounds.left < -240.0) fence_dx += -240.0 - bounds.left;
  if (bounds.right > 240.0) fence_dx += 240.0 - bounds.right;
  if (bounds.top > 180.0) fence_dy += 180.0 - bounds.top;
  if (bounds.bottom < -180.0) fence_dy += -180.0 - bounds.bottom;

  catnip_target_set_xy(target, target->position_x + fence_dx, target->position_y + fence_dy);
}

void catnip_motion_set_rotation_style(catnip_target *target, catnip_hstring *style) {
  if (motion_is(style, "all around")) target->rotation_style = CATNIP_ROTATION_STYLE_ALL_AROUND;
  else if (motion_is(style, "left-right")) target->rotation_style = CATNIP_ROTATION_STYLE_LEFT_RIGHT;
  else if (motion_is(style, "don't rotate")) target->rotation_style = CATNIP_ROTATION_STYLE_NONE;
}

void catnip_motion_glide_begin_xy(catnip_thread *thread, catnip_f64_t x, catnip_f64_t y, catnip_f64_t secs) {
  catnip_target *target = thread->target;
  thread->glide_start_x = target->position_x;
  thread->glide_start_y = target->position_y;
  thread->glide_end_x = x;
  thread->glide_end_y = y;
  thread->glide_duration = secs * 1000.0;
  thread->glide_t0 = (catnip_f64_t) target->runtime->time;
}

void catnip_motion_glide_begin_to(catnip_thread *thread, catnip_hstring *to, catnip_f64_t secs) {
  /* The menu resolves once, when the glide starts — a mouse target is where
     it was at the beginning, like scratch's stack frame. scratch's glideTo
     skips the whole glide when the name matches nothing: no move, no wait —
     a zero duration lands in place and ends the block on the first step. */
  catnip_target *target = thread->target;
  catnip_f64_t x = target->position_x;
  catnip_f64_t y = target->position_y;
  if (!motion_resolve_xy(target, to, &x, &y)) {
    catnip_motion_glide_begin_xy(thread, x, y, 0.0);
    return;
  }

  catnip_motion_glide_begin_xy(thread, x, y, secs);
}

catnip_f64_t catnip_motion_glide_step(catnip_thread *thread) {
  catnip_target *target = thread->target;
  catnip_runtime *runtime = target->runtime;
  catnip_f64_t elapsed = (catnip_f64_t) runtime->time - thread->glide_t0;
  catnip_f64_t duration = thread->glide_duration;

  if (duration <= 0 || elapsed >= duration) {
    /* Done — snap to the final position (for a <= 0 duration this is also the
       first step: land immediately and never move anywhere else). */
    catnip_target_set_xy(target, thread->glide_end_x, thread->glide_end_y);
    return 0;
  }

  catnip_f64_t frac = elapsed / duration;
  catnip_f64_t dx = frac * (thread->glide_end_x - thread->glide_start_x);
  catnip_f64_t dy = frac * (thread->glide_end_y - thread->glide_start_y);

  catnip_target_set_xy(target, thread->glide_start_x + dx, thread->glide_start_y + dy);

  return duration - elapsed;
}

catnip_f64_t catnip_motion_limit_precision(catnip_f64_t coordinate) {
  catnip_f64_t rounded = catnip_math_round(coordinate);
  catnip_f64_t delta = coordinate - rounded;
  return CATNIP_F64_ABS(delta) < 1e-9 ? rounded : coordinate;
}
