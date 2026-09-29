
#include "./catnip.h"

catnip_target *catnip_target_new(struct catnip_runtime *runtime, catnip_sprite *sprite) {
  CATNIP_ASSERT(runtime != CATNIP_NULL);
  CATNIP_ASSERT(sprite != CATNIP_NULL);

  catnip_target *target = catnip_mem_alloc(sizeof(catnip_target));

  catnip_mem_zero(target, sizeof(catnip_target));

  target->runtime = runtime;
  target->sprite = sprite;

  target->variable_table = catnip_mem_alloc(sizeof(catnip_value) * sprite->variable_count);
  catnip_mem_zero(target->variable_table, sizeof(catnip_value) * sprite->variable_count);

  target->list_table = catnip_mem_alloc(sizeof(catnip_list) * sprite->list_count);
  catnip_mem_zero(target->list_table, sizeof(catnip_list) * sprite->list_count);

  target->next_sprite = sprite->target;
  target->prev_sprite = CATNIP_NULL;
  sprite->target = target;

  if (target->next_sprite != CATNIP_NULL) {
    target->next_sprite->prev_sprite = target;
  }

  target->next_global = runtime->targets;
  target->prev_global = CATNIP_NULL;
  runtime->targets = target;

  if (target->next_global != CATNIP_NULL) {
    target->next_global->prev_global = target;
  }

  target->pen_down = CATNIP_FALSE;
  target->pen_argb_valid = CATNIP_TRUE;
  target->pen_argb = 0;
  target->pen_thickness = 1;

  // Scratch's defaults for a freshly created target (the project loader
  // overwrites these; clones arrive through this path).
  target->direction = 90;
  target->size = 100;
  target->rotation_style = CATNIP_ROTATION_STYLE_ALL_AROUND;

  return target;
}

// The running thread of the given script on this target, if there is one.
// A terminated thread does not count: it is about to be swept, and the script
// starting again behaves the same either way.
static catnip_thread *catnip_target_find_thread(catnip_target *target, catnip_thread_fnptr entrypoint) {
  catnip_runtime *runtime = target->runtime;
  catnip_i32_t numThreads = CATNIP_LIST_LENGTH(&runtime->threads, catnip_thread *);

  for (catnip_i32_t i = 0; i < numThreads; ++i) {
    catnip_thread *thread = CATNIP_LIST_GET(&runtime->threads, catnip_thread *, i);

    if (thread->target == target &&
        thread->entrypoint == entrypoint &&
        thread->status != CATNIP_THREAD_STATUS_TERMINATED) {
      return thread;
    }
  }

  return CATNIP_NULL;
}

void catnip_target_start_thread(catnip_target *target, catnip_thread_fnptr entrypoint, catnip_list *threadList, catnip_ui32_t mode) {
  if (mode == CATNIP_THREAD_START_SKIP_IF_RUNNING) {
    if (catnip_target_find_thread(target, entrypoint) != CATNIP_NULL) {
      return;
    }
  } else if (mode == CATNIP_THREAD_START_RESTART) {
    catnip_thread *existing = catnip_target_find_thread(target, entrypoint);

    if (existing != CATNIP_NULL) {
      if (existing == existing->runtime->current_thread) {
        // This is the running script broadcasting its own message. Its frames
        // are live until the call returns, so ask the tick loop to restart it
        // then; the rest of the current run plays out, as it does in
        // scratch-vm, where the old thread finishes its step.
        existing->restart_pending = CATNIP_TRUE;
      } else {
        catnip_thread_restart(existing);
      }

      if (threadList != CATNIP_NULL) {
        CATNIP_LIST_ADD(threadList, catnip_thread *, existing);
        catnip_thread_ref(existing);
      }

      return;
    }
  }

  catnip_thread *newThread = catnip_thread_new(target, entrypoint);

  if (threadList != CATNIP_NULL) {
    CATNIP_LIST_ADD(threadList, catnip_thread *, newThread);
    catnip_thread_ref(newThread);
  }
}

#define CATNIP_EDGE_HAT_NO_VALUE 0
#define CATNIP_EDGE_HAT_FALSE 1
#define CATNIP_EDGE_HAT_TRUE 2

catnip_bool_t catnip_edge_hat_poll(catnip_target *target, catnip_ui32_t key, catnip_bool_t predicate) {
  for (catnip_ui32_t i = 0; i < target->edge_hat_count; ++i) {
    if (target->edge_hat_keys[i] != key) continue;

    catnip_bool_t had_value = target->edge_hat_values[i] != CATNIP_EDGE_HAT_NO_VALUE;
    catnip_bool_t was_true = target->edge_hat_values[i] == CATNIP_EDGE_HAT_TRUE;

    target->edge_hat_values[i] = predicate ? CATNIP_EDGE_HAT_TRUE : CATNIP_EDGE_HAT_FALSE;

    // Rising edge only: true fires when it used to be false, or when this is
    // the first evaluation and it already holds (scratch's edgeWasActivated).
    if (!had_value) return predicate;
    return !was_true && predicate;
  }

  if (target->edge_hat_count == target->edge_hat_capacity) {
    catnip_ui32_t capacity = target->edge_hat_capacity == 0 ? 4 : target->edge_hat_capacity * 2;
    catnip_ui32_t *keys = catnip_mem_alloc(sizeof(catnip_ui32_t) * capacity);
    catnip_ui32_t *values = catnip_mem_alloc(sizeof(catnip_ui32_t) * capacity);

    if (target->edge_hat_capacity != 0) {
      catnip_mem_copy(keys, target->edge_hat_keys, sizeof(catnip_ui32_t) * target->edge_hat_count);
      catnip_mem_copy(values, target->edge_hat_values, sizeof(catnip_ui32_t) * target->edge_hat_count);
      catnip_mem_free(target->edge_hat_keys);
      catnip_mem_free(target->edge_hat_values);
    }

    target->edge_hat_keys = keys;
    target->edge_hat_values = values;
    target->edge_hat_capacity = capacity;
  }

  target->edge_hat_keys[target->edge_hat_count] = key;
  target->edge_hat_values[target->edge_hat_count] = predicate ? CATNIP_EDGE_HAT_TRUE : CATNIP_EDGE_HAT_FALSE;
  target->edge_hat_count++;

  return predicate;
}

void catnip_edge_hat_clear_all(struct catnip_runtime *runtime) {
  for (catnip_target *t = runtime->targets; t != CATNIP_NULL; t = t->next_global)
    t->edge_hat_count = 0;
}

void catnip_edge_hat_copy(catnip_target *to, catnip_target *from) {
  if (from->edge_hat_count == 0) return;

  catnip_ui32_t count = from->edge_hat_count;
  to->edge_hat_keys = catnip_mem_alloc(sizeof(catnip_ui32_t) * count);
  to->edge_hat_values = catnip_mem_alloc(sizeof(catnip_ui32_t) * count);
  catnip_mem_copy(to->edge_hat_keys, from->edge_hat_keys, sizeof(catnip_ui32_t) * count);
  catnip_mem_copy(to->edge_hat_values, from->edge_hat_values, sizeof(catnip_ui32_t) * count);
  to->edge_hat_count = count;
  to->edge_hat_capacity = count;
}

void catnip_target_set_direction(catnip_target *target, catnip_f64_t direction) {
  if (target->flags & CATNIP_TARGET_FLAG_IS_STAGE) return;
  if (CATNIP_F64_ISNAN(direction) || CATNIP_F64_ISINFINITE(direction)) return;

  // Keep direction between -179 and +180 (scratch-vm MathUtil.wrapClamp).
  target->direction = direction - CATNIP_F64_FLOOR((direction + 179.0) / 360.0) * 360.0;
}

void catnip_target_get_bounds(catnip_target *target, catnip_bounds *out) {
  catnip_f64_t left = 0, right = 0, top = 0, bottom = 0;

  // The costume's own rectangle relative to its rotation center; a target
  // without a costume (or before the host measured it) bounds to a point.
  if (target->costume < target->sprite->costume_count) {
    catnip_costume *costume = &target->sprite->costumes[target->costume];
    left = costume->aabb_left;
    right = costume->aabb_right;
    top = costume->aabb_top;
    bottom = costume->aabb_bottom;
  }

  catnip_f64_t scale = target->size / 100.0;
  left *= scale;
  right *= scale;
  top *= scale;
  bottom *= scale;

  catnip_f64_t theta = 0;
  if (target->rotation_style == CATNIP_ROTATION_STYLE_ALL_AROUND) {
    // Scratch renders direction 90 facing right; sign does not matter for an
    // axis-aligned box of a box, but this matches the drawable's rotation.
    theta = (target->direction - 90.0) * (CATNIP_F64_PI / 180.0);
  } else if (target->rotation_style == CATNIP_ROTATION_STYLE_LEFT_RIGHT &&
             target->direction < 0) {
    // Left-right mirrors the costume about the rotation center on x.
    catnip_f64_t oldLeft = left;
    left = -right;
    right = -oldLeft;
  }

  if (theta != 0) {
    catnip_f64_t cosT = catnip_math_cos(theta);
    catnip_f64_t sinT = catnip_math_sin(theta);

    catnip_f64_t xs[4] = { left, right, left, right };
    catnip_f64_t ys[4] = { top, top, bottom, bottom };
    catnip_f64_t minX = 0, maxX = 0, minY = 0, maxY = 0;

    for (catnip_i32_t i = 0; i < 4; i++) {
      catnip_f64_t x = xs[i] * cosT - ys[i] * sinT;
      catnip_f64_t y = xs[i] * sinT + ys[i] * cosT;
      if (i == 0 || x < minX) minX = x;
      if (i == 0 || x > maxX) maxX = x;
      if (i == 0 || y < minY) minY = y;
      if (i == 0 || y > maxY) maxY = y;
    }

    left = minX;
    right = maxX;
    top = maxY;
    bottom = minY;
  }

  out->left = target->position_x + left;
  out->right = target->position_x + right;
  out->top = target->position_y + top;
  out->bottom = target->position_y + bottom;
}

void catnip_target_set_xy(catnip_target* target, catnip_f64_t x, catnip_f64_t y) {
  // The stage never moves (scratch-vm setXY returns for it too).
  if (target->flags & CATNIP_TARGET_FLAG_IS_STAGE) return;

  // scratch-vm runs every move through the renderer's fence so the costume's
  // box cannot leave the stage: the crossing edge stops FENCE_WIDTH (15px)
  // inside, or closer when the costume is smaller than twice that (which is
  // why this lived behind "we don't have the costume yet" for so long).
  catnip_bounds bounds;
  catnip_target_get_bounds(target, &bounds);

  catnip_f64_t dx = x - target->position_x;
  catnip_f64_t dy = y - target->position_y;

  catnip_f64_t inset = CATNIP_F64_FLOOR(CATNIP_MIN(bounds.right - bounds.left, bounds.top - bounds.bottom) / 2.0);
  catnip_f64_t sx = 240.0 - CATNIP_MIN(15.0, inset);
  catnip_f64_t sy = 180.0 - CATNIP_MIN(15.0, inset);

  if (bounds.right + dx < -sx) {
    x = CATNIP_F64_CEIL(target->position_x - (sx + bounds.right));
  } else if (bounds.left + dx > sx) {
    x = CATNIP_F64_FLOOR(target->position_x + (sx - bounds.left));
  }

  if (bounds.top + dy < -sy) {
    y = CATNIP_F64_CEIL(target->position_y - (sy + bounds.top));
  } else if (bounds.bottom + dy > sy) {
    y = CATNIP_F64_FLOOR(target->position_y + (sy - bounds.bottom));
  }

  if (target->pen_down) {
    catnip_runtime_render_pen_draw_line(
      target->runtime,
      target,
      (catnip_f32_t) target->position_x,
      (catnip_f32_t) target->position_y,
      (catnip_f32_t) x,
      (catnip_f32_t) y
    );
  }

  target->position_x = x;
  target->position_y = y;
}