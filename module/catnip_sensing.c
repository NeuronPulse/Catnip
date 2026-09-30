
#include "./catnip_sensing.h"
#include "./catnip_looks.h"
#include "./catnip_math.h"
#include "./catnip_mem.h"

/* ask and wait ----------------------------------------------------------- */

/* The question UI lives in the host: catnip_import_ask_show puts the prompt
   up (or catnip_import_ask_hide takes it down), the host answers with
   catnip_sensing_answer_set. Everything queue-shaped stays here so the
   generated code only ever sees a ticket. */

typedef struct ask_node {
  catnip_hstring *question; /* canon copy: queued past the asking block */
  catnip_target *target;
  catnip_bool_t show_bubble;
  struct ask_node *next;
} ask_node;

static ask_node *ask_head = CATNIP_NULL;
static ask_node *ask_tail = CATNIP_NULL;
static catnip_ui32_t ask_enqueued = 0;
static catnip_ui32_t ask_answered = 0;
static catnip_bool_t ask_showing = CATNIP_FALSE;
static catnip_hstring *sensing_answer = CATNIP_NULL;

static void ask_show(ask_node *node) {
  /* Scratch's _askNextQuestion: the prompt goes up when the question reaches
     the head of the queue, and the asking target says it unless it was the
     stage or was hidden when it asked (that visibility is latched at
     enqueue time, like scratch's stored wasVisible). The bubble goes up
     before the import: the host may answer from inside the show hook (the
     test harness does), which frees this node, so nothing may touch it
     afterwards. */
  if (node->show_bubble)
    catnip_looks_say(node->question, CATNIP_BUBBLE_SAY, node->target);
  ask_showing = CATNIP_TRUE;
  catnip_import_ask_show(catnip_hstring_get_data(node->question),
                         CATNIP_HSTRING_LENGTH(node->question));
}

static void ask_hide_if_showing(void) {
  if (!ask_showing) return;
  ask_showing = CATNIP_FALSE;
  catnip_import_ask_hide();
}

static void ask_clear_bubble(ask_node *node) {
  if (node->show_bubble)
    catnip_looks_say(CATNIP_NULL, CATNIP_BUBBLE_NONE, node->target);
}

catnip_ui32_t catnip_sensing_ask(catnip_hstring *question, catnip_target *target) {
  ask_node *node = catnip_mem_alloc(sizeof(ask_node));
  node->question = catnip_import_get_canon_string(
      catnip_hstring_get_data(question), CATNIP_HSTRING_LENGTH(question));
  node->target = target;
  node->show_bubble =
      !(target->flags & CATNIP_TARGET_FLAG_IS_STAGE) &&
      (target->flags & CATNIP_TARGET_FLAG_IS_VISIBLE);
  node->next = CATNIP_NULL;

  const catnip_bool_t was_empty = ask_head == CATNIP_NULL;
  if (was_empty) ask_head = node;
  else ask_tail->next = node;
  ask_tail = node;

  const catnip_ui32_t ticket = ask_enqueued++;

  /* A host may answer from inside the show hook (the test harness does);
     everything above must already be in place before this call. */
  if (was_empty) ask_show(node);

  return ticket;
}

catnip_bool_t catnip_sensing_ask_done(catnip_ui32_t ticket) {
  /* The node with this ticket is popped exactly when ask_answered passes it. */
  return ticket < ask_answered;
}

void catnip_sensing_answer_set(catnip_hstring *answer) {
  /* scratch-vm _onAnswer: the answer lands first, even with no question
     pending, and only then is the head question resolved. */
  sensing_answer = answer;

  if (ask_head == CATNIP_NULL) return;

  ask_node *node = ask_head;
  ask_head = node->next;
  if (ask_head == CATNIP_NULL) ask_tail = CATNIP_NULL;
  ask_answered++;

  ask_clear_bubble(node);
  catnip_mem_free(node);

  if (ask_head != CATNIP_NULL) ask_show(ask_head);
  else ask_hide_if_showing();
}

catnip_hstring *catnip_sensing_answer_get(void) {
  if (sensing_answer == CATNIP_NULL)
    sensing_answer = catnip_import_get_canon_string(CATNIP_NULL, 0);
  return sensing_answer;
}

void catnip_sensing_ask_reset(void) {
  while (ask_head != CATNIP_NULL) {
    ask_node *node = ask_head;
    ask_head = node->next;
    ask_clear_bubble(node);
    catnip_mem_free(node);
  }
  ask_tail = CATNIP_NULL;
  ask_enqueued = 0;
  ask_answered = 0;
  sensing_answer = CATNIP_NULL;
  ask_hide_if_showing();
}

/* distanceto -------------------------------------------------------------- */

/* Compares an hstring to an ASCII literal, e.g. "_mouse_". */
static catnip_bool_t sensing_is(const catnip_hstring *str, const char *cstr) {
  if (str == 0) return CATNIP_FALSE;

  catnip_wchar_t *data = catnip_hstring_get_data(str);
  catnip_ui32_t len = CATNIP_HSTRING_LENGTH(str);

  catnip_ui32_t i = 0;
  while (cstr[i] != '\0') {
    if (i >= len) return CATNIP_FALSE;
    if (data[i] != (catnip_wchar_t)cstr[i]) return CATNIP_FALSE;
    i++;
  }

  return i == len;
}

/* scratch runtime.getSpriteTargetByName: never the stage, never a clone
   (catnip chains clones in front, so they are skipped explicitly). */
static catnip_target *sensing_find_sprite(catnip_runtime *runtime, const catnip_hstring *name) {
  for (catnip_target *t = runtime->targets; t != 0; t = t->next_global) {
    if (t->flags & CATNIP_TARGET_FLAG_IS_CLONE) continue;
    if (t->flags & CATNIP_TARGET_FLAG_IS_STAGE) continue;
    if (t->sprite != 0 && t->sprite->name != 0 && catnip_hstring_equal(t->sprite->name, name))
      return t;
  }

  return 0;
}

/* scratch3_sensing.js distanceTo: the stage is always 10000 away, the mouse
   is its scratch position, a sprite that exists is its x/y, anything else
   is 10000. Pure geometry — no bounds, no effects. */
catnip_f64_t catnip_sensing_distance_to(const catnip_hstring *option, catnip_target *self) {
  if (self->flags & CATNIP_TARGET_FLAG_IS_STAGE) return 10000.0;

  catnip_f64_t target_x;
  catnip_f64_t target_y;

  if (sensing_is(option, "_mouse_")) {
    target_x = self->runtime->io->mouse_x;
    target_y = self->runtime->io->mouse_y;
  } else {
    catnip_target *other = sensing_find_sprite(self->runtime, option);
    if (other == 0) return 10000.0;
    target_x = other->position_x;
    target_y = other->position_y;
  }

  const catnip_f64_t dx = self->position_x - target_x;
  const catnip_f64_t dy = self->position_y - target_y;
  return CATNIP_F64_SQRT((dx * dx) + (dy * dy));
}

/* of ----------------------------------------------------------------------- */

/* NaN-boxes a string into an f64, the catnip_value string encoding. The
   name pointers here are the same rooted strings every other value path
   hands around (costume names, variable values). */
static catnip_f64_t sensing_box_name(const catnip_hstring *name) {
  catnip_value value;
  value.parts.lower = (catnip_ui32_t)name;
  value.parts.upper = CATINP_VALUE_STRING_UPPER;
  return value.val_double;
}

/* scratch3_sensing.js getAttributeOf, case for case: the stage-only and
   sprite-only property switches, then a local-variable lookup by name,
   then 0. OBJECT resolves exactly like getSpriteTargetByName (_stage_ is
   the stage, anything else a non-stage original), and a missing target or
   property gives 0. */
catnip_f64_t catnip_sensing_of(const catnip_hstring *object, const catnip_hstring *property, catnip_target *self) {
  catnip_runtime *runtime = self->runtime;
  catnip_target *attr_target = CATNIP_NULL;

  if (sensing_is(object, "_stage_")) {
    for (catnip_target *t = runtime->targets; t != CATNIP_NULL; t = t->next_global) {
      if (t->flags & CATNIP_TARGET_FLAG_IS_STAGE) {
        attr_target = t;
        break;
      }
    }
  } else {
    attr_target = sensing_find_sprite(runtime, object);
  }

  if (attr_target == CATNIP_NULL) return 0.0;

  if (attr_target->flags & CATNIP_TARGET_FLAG_IS_STAGE) {
    if (sensing_is(property, "background #") || sensing_is(property, "backdrop #"))
      return (catnip_f64_t)attr_target->costume + 1.0;
    if (sensing_is(property, "backdrop name")) {
      if (attr_target->costume >= attr_target->sprite->costume_count) return 0.0;
      return sensing_box_name(attr_target->sprite->costumes[attr_target->costume].name);
    }
    if (sensing_is(property, "volume"))
      return (catnip_f64_t)attr_target->volume;
  } else {
    if (sensing_is(property, "x position")) return attr_target->position_x;
    if (sensing_is(property, "y position")) return attr_target->position_y;
    if (sensing_is(property, "direction")) return attr_target->direction;
    if (sensing_is(property, "costume #"))
      return (catnip_f64_t)attr_target->costume + 1.0;
    if (sensing_is(property, "costume name")) {
      if (attr_target->costume >= attr_target->sprite->costume_count) return 0.0;
      return sensing_box_name(attr_target->sprite->costumes[attr_target->costume].name);
    }
    if (sensing_is(property, "size")) return attr_target->size;
    if (sensing_is(property, "volume"))
      return (catnip_f64_t)attr_target->volume;
  }

  /* The property may be a local variable's name (scratch falls through to
     lookupVariableByNameAndType); values sit in the target's own table. */
  for (catnip_ui32_t i = 0; i < attr_target->sprite->variable_count; i++) {
    catnip_variable *variable = attr_target->sprite->variables[i];
    if (variable != CATNIP_NULL && variable->name != CATNIP_NULL &&
        catnip_hstring_equal(variable->name, property))
      return attr_target->variable_table[i].val_double;
  }

  return 0.0;
}

/* setdragmode ------------------------------------------------------------- */

/* scratch3_sensing.js setDragMode: DRAG_MODE === 'draggable' flips
   target.draggable; the actual dragging lives in the host (scratch-gui
   does it), which reads the flag back through the mouse handling. */
void catnip_sensing_set_drag_mode(catnip_f64_t mode, catnip_target *self) {
  if (mode != 0.0)
    self->flags |= CATNIP_TARGET_FLAG_IS_DRAGGABLE;
  else
    self->flags &= ~((catnip_ui32_t)CATNIP_TARGET_FLAG_IS_DRAGGABLE);
}
