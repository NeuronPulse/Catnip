

#ifndef CATNIP_THREAD_H_INCLUDED
#define CATNIP_THREAD_H_INCLUDED

#include "./catnip.h"

typedef catnip_ui32_t catnip_thread_status;

#define CATNIP_THREAD_STATUS_RUNNING 0
#define CATNIP_THREAD_STATUS_YIELD 1
#define CATNIP_THREAD_STATUS_YIELD_TICK 2
#define CATNIP_THREAD_STATUS_TERMINATED 3

struct catnip_thread;
typedef struct catnip_thread catnip_thread;

struct catnip_thread {

  catnip_runtime *runtime;
  catnip_target *target;
  catnip_thread_fnptr function;
  catnip_thread_status status;

  catnip_value *stack_ptr;
  catnip_value *stack_end;
  catnip_value *stack_start;

  // How many owners the thread struct has: the runtime's thread list, plus one
  // for every wait list (broadcast and wait) holding it. A terminated thread is
  // dropped from the runtime list right away, but a wait list still polls its
  // status, so the struct outlives the thread until every owner has let go.
  // See catnip_thread_unref.
  catnip_ui32_t ref_count;
};

catnip_thread *catnip_thread_new(catnip_target *target, catnip_thread_fnptr entrypoint);
void catnip_thread_yield(catnip_thread *thread, catnip_thread_fnptr dst);
void catnip_thread_terminate(catnip_thread *thread);
/* Stops every thread, including the one that asked. The caller must return
   from its entry point right away: the runtime will not call it again. */
void catnip_thread_stop_all(catnip_thread *thread);
/* Stops every other thread running on the caller's target. The caller keeps
   running. */
void catnip_thread_stop_other_scripts(catnip_thread *thread);
void catnip_thread_ref(catnip_thread *thread);
void catnip_thread_unref(catnip_thread *thread);
void catnip_thread_free_stack(catnip_thread *thread);
void catnip_thread_resize_stack(catnip_thread *thread, catnip_ui32_t extraCapacity);
void *catnip_thread_allocate_stack(catnip_thread *thread, catnip_ui32_t capacity);
#endif
