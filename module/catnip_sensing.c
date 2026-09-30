
#include "./catnip_sensing.h"
#include "./catnip_looks.h"
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
