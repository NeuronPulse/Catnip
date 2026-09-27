
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
  if (mode == CATNIP_THREAD_START_RESTART) {
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

void catnip_target_set_xy(catnip_target* target, catnip_f64_t x, catnip_f64_t y) {

  // TODO We need to do fencing here, but that requires information about the costume we don't have yet.

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