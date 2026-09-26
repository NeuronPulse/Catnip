
#include "./catnip.h"

const catnip_ui32_t INITIAL_STACK_SIZE = 16;

catnip_thread *catnip_thread_new(catnip_target *target, catnip_thread_fnptr entrypoint) {
  CATNIP_ASSERT(target != CATNIP_NULL);
  CATNIP_ASSERT(entrypoint != CATNIP_NULL);

  catnip_thread *thread = catnip_mem_alloc(sizeof(catnip_thread));

  thread->runtime = target->runtime;
  thread->function = entrypoint;
  thread->target = target;
  thread->status = CATNIP_THREAD_STATUS_RUNNING;

  thread->stack_start = catnip_mem_alloc(INITIAL_STACK_SIZE * sizeof(catnip_value));
  thread->stack_ptr = thread->stack_start;
  thread->stack_end = thread->stack_start + INITIAL_STACK_SIZE;

  thread->ref_count = 1;

  CATNIP_LIST_ADD(&thread->runtime->threads, catnip_thread *, thread);

  return thread;
}

void catnip_thread_ref(catnip_thread *thread) {
  CATNIP_ASSERT(thread != CATNIP_NULL);

  ++thread->ref_count;
}

void catnip_thread_unref(catnip_thread *thread) {
  CATNIP_ASSERT(thread != CATNIP_NULL);
  CATNIP_ASSERT(thread->ref_count != 0);

  if (--thread->ref_count != 0)
    return;

  // The stack was freed when the thread was swept, if it ever got that far.
  catnip_thread_free_stack(thread);

  catnip_mem_free(thread);
}

void catnip_thread_free_stack(catnip_thread *thread) {
  CATNIP_ASSERT(thread != CATNIP_NULL);

  if (thread->stack_start == CATNIP_NULL)
    return;

  catnip_mem_free(thread->stack_start);

  // Nulled rather than left dangling: the garbage collector walks the stacks of
  // the threads it finds, and a terminated thread's stack is no longer a root
  // set — nothing can reach it again.
  thread->stack_start = CATNIP_NULL;
  thread->stack_ptr = CATNIP_NULL;
  thread->stack_end = CATNIP_NULL;
}

void catnip_thread_yield(catnip_thread *thread, catnip_thread_fnptr dst) {
  CATNIP_ASSERT(thread != CATNIP_NULL);
  CATNIP_ASSERT(dst != CATNIP_NULL);

  thread->function = dst;
  thread->status = CATNIP_THREAD_STATUS_YIELD;
}

void catnip_thread_terminate(catnip_thread *thread) {
  CATNIP_ASSERT(thread != CATNIP_NULL);
  thread->status = CATNIP_THREAD_STATUS_TERMINATED;
}

// Terminates every other thread the runtime is running. Terminating a thread
// is what a thread does to itself when it runs off the end of its script, so
// everything that follows from a thread finishing (the waiters on a broadcast
// and wait are unref'd when the thread is swept) follows from this too.
static void catnip_thread_terminate_other_threads(catnip_thread *thread, catnip_bool_t same_target_only) {
  catnip_runtime *runtime = thread->runtime;
  catnip_i32_t numThreads = CATNIP_LIST_LENGTH(&runtime->threads, catnip_thread *);

  for (catnip_i32_t i = 0; i < numThreads; ++i) {
    catnip_thread *other = CATNIP_LIST_GET(&runtime->threads, catnip_thread *, i);

    if (other == thread) continue;
    if (same_target_only && other->target != thread->target) continue;

    catnip_thread_terminate(other);
  }
}

void catnip_thread_stop_all(catnip_thread *thread) {
  CATNIP_ASSERT(thread != CATNIP_NULL);

  catnip_thread_terminate_other_threads(thread, CATNIP_FALSE);

  // The caller goes last: it still has a frame on the stack that has to return
  // to the runtime before its stack can be freed.
  catnip_thread_terminate(thread);
}

void catnip_thread_stop_other_scripts(catnip_thread *thread) {
  CATNIP_ASSERT(thread != CATNIP_NULL);

  catnip_thread_terminate_other_threads(thread, CATNIP_TRUE);
}

void *catnip_thread_allocate_stack(catnip_thread *thread, catnip_ui32_t capacity) {
  catnip_value *newStackPtr = ((void *) thread->stack_ptr) + capacity;

  if (thread->stack_end < newStackPtr) {
    catnip_thread_resize_stack(thread, capacity);
    newStackPtr = thread->stack_ptr + capacity;
  }

  void *stackPtr = thread->stack_ptr;
  thread->stack_ptr = newStackPtr;
  return stackPtr;
}

void catnip_thread_resize_stack(catnip_thread *thread, catnip_ui32_t extraCapacity) {
  CATNIP_ASSERT(thread != CATNIP_NULL);

  const catnip_i32_t oldStackRemainingCapacity = thread->stack_end - thread->stack_ptr;

  if (oldStackRemainingCapacity >= extraCapacity)
    return;

  const catnip_i32_t oldStackCapacity = thread->stack_end - thread->stack_start;
  
  catnip_i32_t newStackCapacity = oldStackCapacity * 2;

  if (newStackCapacity - oldStackRemainingCapacity < extraCapacity) {
    newStackCapacity += extraCapacity - oldStackRemainingCapacity;
  }

  catnip_value *newStack = catnip_mem_alloc(newStackCapacity * sizeof(catnip_value));

  const catnip_i32_t oldStackLength = thread->stack_ptr - thread->stack_start;

  catnip_mem_copy(newStack, thread->stack_start, oldStackLength * sizeof(catnip_value));

  thread->stack_start = newStack;
  thread->stack_end = newStack + newStackCapacity;
  thread->stack_ptr = newStack + oldStackLength;
}