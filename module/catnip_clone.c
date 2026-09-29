#include "./catnip.h"
#include "./catnip_clone.h"
#include "./catnip_thread.h"

/* scratch-vm's Runtime.MAX_CLONES: clonesAvailable() refuses past this. */
#define CATNIP_MAX_CLONES 300

static catnip_bool_t catnip_clone_is_myself(const catnip_hstring *option) {
  static const char me[] = "_myself_";
  catnip_ui32_t len = CATNIP_HSTRING_LENGTH(option);
  if (len != sizeof(me) - 1) return CATNIP_FALSE;

  const catnip_wchar_t *data = catnip_hstring_get_data(option);
  for (catnip_ui32_t i = 0; i < len; i++) {
    if (data[i] != (catnip_wchar_t) me[i]) return CATNIP_FALSE;
  }
  return CATNIP_TRUE;
}

catnip_target *catnip_clone_resolve_source(catnip_hstring *option, catnip_runtime *runtime, catnip_target *current) {
  CATNIP_ASSERT(runtime != CATNIP_NULL);

  if (option == CATNIP_NULL) return CATNIP_NULL;

  /* scratch3_control.createClone: '_myself_' is util.target — the target the
     running script belongs to, which may itself be a clone. */
  if (catnip_clone_is_myself(option))
    return current;

  /* Otherwise runtime.getSpriteTargetByName: scratch's runtime.targets array
     holds the originals from load time, so the first name match is always an
     original — clones (whose sprite is the same, so the name matches too)
     were appended later. Our chain is prepended instead, which would put a
     clone ahead of its own sprite, so clones are skipped outright; the only
     duplicated names in the project are clone names. A stage match comes
     back too, rejected by catnip_clone_create below like makeClone's
     isStage guard (scratch's own loop skips the stage and gets null). */
  for (catnip_target *t = runtime->targets; t != CATNIP_NULL; t = t->next_global) {
    if (t->flags & CATNIP_TARGET_FLAG_IS_CLONE) continue;
    if (t->sprite->name != CATNIP_NULL && catnip_hstring_equal(option, t->sprite->name))
      return t;
  }

  return CATNIP_NULL;
}

static catnip_ui32_t catnip_clone_count(struct catnip_runtime *runtime) {
  catnip_ui32_t count = 0;
  for (catnip_target *t = runtime->targets; t != CATNIP_NULL; t = t->next_global)
    if (t->flags & CATNIP_TARGET_FLAG_IS_CLONE) count++;
  return count;
}

catnip_target *catnip_clone_create(catnip_target *source) {
  if (source == CATNIP_NULL) return CATNIP_NULL;

  /* scratch-vm makeClone: hit max clone limit, or this is the stage. */
  if (source->flags & CATNIP_TARGET_FLAG_IS_STAGE) return CATNIP_NULL;
  if (catnip_clone_count(source->runtime) >= CATNIP_MAX_CLONES) return CATNIP_NULL;

  catnip_runtime *runtime = source->runtime;
  catnip_sprite *sprite = source->sprite;

  /* target_new links the clone into both chains and gives it the scratch
     defaults a fresh RenderedTarget starts with — the copies below overwrite
     exactly the fields makeClone copies. */
  catnip_target *clone = catnip_target_new(runtime, sprite);
  clone->flags |= CATNIP_TARGET_FLAG_IS_CLONE;
  if (source->flags & CATNIP_TARGET_FLAG_IS_VISIBLE)
    clone->flags |= CATNIP_TARGET_FLAG_IS_VISIBLE;

  clone->position_x = source->position_x;
  clone->position_y = source->position_y;
  clone->direction = source->direction;
  clone->size = source->size;
  clone->costume = source->costume;
  clone->rotation_style = source->rotation_style;

  clone->effect_color = source->effect_color;
  clone->effect_fisheye = source->effect_fisheye;
  clone->effect_whirl = source->effect_whirl;
  clone->effect_pixelate = source->effect_pixelate;
  clone->effect_mosaic = source->effect_mosaic;
  clone->effect_brightness = source->effect_brightness;
  clone->effect_ghost = source->effect_ghost;

  clone->volume = source->volume;
  clone->tempo = source->tempo;

  /* scratch's duplicateVariables(): scalars copy by value, lists get a fresh
     buffer holding the same entries (duplicateVariable's value.slice(0)) —
     after this the clone's list edits never reach the original. The copied
     values are bitwise copies of catnip_value: a string they point at is
     simply rooted twice, which the mark pass handles. */
  if (sprite->variable_count > 0) {
    catnip_mem_copy(clone->variable_table, source->variable_table,
                    sizeof(catnip_value) * sprite->variable_count);
  }

  for (catnip_ui32_t i = 0; i < sprite->list_count; i++) {
    catnip_list *src = &source->list_table[i];
    catnip_list *dst = &clone->list_table[i];

    dst->length = src->length;
    dst->capacity = src->capacity;
    if (src->capacity != 0) {
      dst->data = catnip_mem_alloc(src->capacity * sizeof(catnip_value));
      if (src->length > 0)
        catnip_mem_copy(dst->data, src->data, src->length * sizeof(catnip_value));
    }
  }

  return clone;
}

catnip_i32_t catnip_clone_delete(catnip_target *target) {
  if (target == CATNIP_NULL) return 0;
  /* scratch3_control.deleteClone: if (util.target.isOriginal) return. */
  if (!(target->flags & CATNIP_TARGET_FLAG_IS_CLONE)) return 0;

  catnip_runtime *runtime = target->runtime;

  /* RenderedTarget.dispose stops every thread on this target before the
     target goes away (runtime.stopForTarget). The calling thread is left
     alone: its frames are still live, and the IR terminates it right after
     this returns. */
  catnip_i32_t numThreads = CATNIP_LIST_LENGTH(&runtime->threads, catnip_thread *);
  for (catnip_i32_t i = 0; i < numThreads; ++i) {
    catnip_thread *other = CATNIP_LIST_GET(&runtime->threads, catnip_thread *, i);
    if (other != runtime->current_thread && other->target == target)
      catnip_thread_terminate(other);
  }

  /* Unlink from the global chain. */
  if (target->prev_global != CATNIP_NULL)
    target->prev_global->next_global = target->next_global;
  else
    runtime->targets = target->next_global;

  if (target->next_global != CATNIP_NULL)
    target->next_global->prev_global = target->prev_global;

  /* Unlink from the sprite chain (sprite->target is its head). */
  if (target->prev_sprite != CATNIP_NULL)
    target->prev_sprite->next_sprite = target->next_sprite;
  else
    target->sprite->target = target->next_sprite;

  if (target->next_sprite != CATNIP_NULL)
    target->next_sprite->prev_sprite = target->prev_sprite;

  /* The clone owns its tables (copies, not shares), so free them with it. */
  for (catnip_ui32_t i = 0; i < target->sprite->list_count; i++) {
    catnip_list *list = &target->list_table[i];
    if (list->capacity != 0) catnip_mem_free(list->data);
  }
  catnip_mem_free(target->list_table);
  catnip_mem_free(target->variable_table);
  catnip_mem_free(target);

  return 1;
}

void catnip_clone_dispose_all(catnip_runtime *runtime) {
  CATNIP_ASSERT(runtime != CATNIP_NULL);

  /* runtime.stopAll: every non-original target is disposed, which stops its
     threads and drops it from the target list. Walking with next_global
     saved first because dispose unlinks the node we are on. */
  catnip_target *t = runtime->targets;
  while (t != CATNIP_NULL) {
    catnip_target *next = t->next_global;
    if (t->flags & CATNIP_TARGET_FLAG_IS_CLONE)
      catnip_clone_delete(t);
    t = next;
  }
}
