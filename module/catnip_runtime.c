
#include "./catnip_runtime.h"

#include "./catnip_runtime_gc.c"
#include "./catnip_runtime_render.c"

catnip_ui64_t update_time(catnip_runtime *rt) {
  return rt->time = catnip_import_time();
}

catnip_runtime *catnip_runtime_new() {

  catnip_runtime *rt = catnip_mem_alloc(sizeof(catnip_runtime));

  rt->sprite_count = 0;
  rt->sprites = CATNIP_NULL;

  rt->targets = CATNIP_NULL;

  CATNIP_LIST_INIT(&rt->threads, catnip_thread *, 8);
  rt->num_active_threads = 0;

  rt->gc_page_index = -1;
  rt->gc_page = CATNIP_NULL;
  CATNIP_LIST_INIT(&rt->gc_pages, catnip_gc_page *, 4);
  CATNIP_LIST_INIT(&rt->gc_large_objs, catnip_obj_head *, 0);
  rt->gc_alloc_since_last_gc = 0;
  rt->gc_alloc_threshold = CATNIP_GC_MIN_ALLOC_BYTES;

  // Left null when stats are compiled out, so the host can tell the difference
  // between "no stats" and a garbage pointer.
  rt->gc_stats = CATNIP_NULL;
#ifdef CATNIP_GC_STATS
  rt->gc_stats = catnip_mem_alloc(sizeof(catnip_runtime_gc_stats));
  catnip_mem_zero(rt->gc_stats, sizeof(catnip_runtime_gc_stats));
#endif

  rt->pen_line_buffer = catnip_mem_alloc(sizeof(catnip_pen_line) * CATNIP_RENDER_PEN_LINE_BUFFER_SIZE);
  rt->pen_line_buffer_length = 0;

  rt->io = catnip_mem_alloc(sizeof(catnip_io));
  catnip_mem_zero(rt->io, sizeof(catnip_io));

  rt->random_state = catnip_mem_alloc(sizeof(catnip_math_random_state));

  rt->warp_check_counter = 0;
  
  update_time(rt);
  rt->timer_start = rt->time;

  return rt;
}

void catnip_runtime_tick(catnip_runtime *runtime) {
  CATNIP_ASSERT(runtime != CATNIP_NULL);

  update_time(runtime);

  // The budget is spent between thread passes, so generated warp loops also
  // check this deadline: a warp loop that would otherwise run for seconds in one
  // go yields once the tick is out of time, and is resumed on the next tick.
  catnip_f64_t tickStartTime = catnip_import_perf_time();
  runtime->tick_deadline = tickStartTime + (catnip_f64_t) runtime->cfg_tick_time;

  catnip_bool_t ranFirstTick = CATNIP_FALSE;

  runtime->redraw_requested = CATNIP_FALSE;
  runtime->num_active_threads = CATNIP_LIST_LENGTH(&runtime->threads, catnip_thread *);

  while ((runtime->num_active_threads != 0) &&
        (!runtime->redraw_requested || runtime->cfg_turbomode) &&
        (catnip_import_perf_time() < runtime->tick_deadline)) {

    runtime->num_active_threads = 0;

    for (catnip_i32_t i = 0; i < CATNIP_LIST_LENGTH(&runtime->threads, catnip_thread *); i++) {

      catnip_thread *thread = CATNIP_LIST_GET(&runtime->threads, catnip_thread *, i);

      if (thread->status == CATNIP_THREAD_STATUS_YIELD) {
        thread->status = CATNIP_THREAD_STATUS_RUNNING;
      }

      if (thread->status == CATNIP_THREAD_STATUS_YIELD_TICK && !ranFirstTick) {
        thread->status = CATNIP_THREAD_STATUS_RUNNING;
      }

      catnip_i32_t lc = 0;

      while (thread->status == CATNIP_THREAD_STATUS_RUNNING) {
        thread->function(thread);

        if (++lc > 100000000)
          CATNIP_ASSERT(CATNIP_FALSE);

        // Checked after every call rather than only between passes: the clock
        // read can't be optimized out (it's an import), so a thread that never
        // yields still gives the tick back in bounded time.
        if (catnip_import_perf_time() >= runtime->tick_deadline)
          break;
      }

      if (thread->status != CATNIP_THREAD_STATUS_TERMINATED)
        ++runtime->num_active_threads;
    }

    ranFirstTick = CATNIP_TRUE;

    // Drop the threads that terminated in that pass, keeping the list in start
    // order. The list is the GC's root set and every pass of every tick walks
    // it, so a project that starts a script every frame would otherwise pay,
    // forever, for every thread it has ever started. The stacks go with the
    // threads; the structs stay while a wait list still points at one
    // (see catnip_thread_unref).
    catnip_i32_t numThreads = CATNIP_LIST_LENGTH(&runtime->threads, catnip_thread *);
    catnip_i32_t numLiveThreads = 0;

    for (catnip_i32_t i = 0; i < numThreads; ++i) {
      catnip_thread *thread = CATNIP_LIST_GET(&runtime->threads, catnip_thread *, i);

      if (thread->status == CATNIP_THREAD_STATUS_TERMINATED) {
        catnip_thread_free_stack(thread);
        catnip_thread_unref(thread);
        continue;
      }

      if (numLiveThreads != i)
        *CATNIP_LIST_GET_PTR_DANGER(&runtime->threads, catnip_thread *, numLiveThreads) = thread;

      ++numLiveThreads;
    }

    CATNIP_LIST_SET_LENGTH(&runtime->threads, numLiveThreads);

    // Collecting on every pass over the threads means walking the whole heap
    // many times per tick, even when almost nothing has been allocated since
    // the last collection. Wait for enough new garbage to pile up instead.
    if (runtime->gc_alloc_since_last_gc >= runtime->gc_alloc_threshold)
      catnip_runtime_gc(runtime);
  }
}

catnip_bool_t catnip_runtime_warp_expired(catnip_runtime *runtime) {
  // Generated warp loops call this at every loop boundary, so the cost here is
  // paid per iteration. Reading the clock means calling out of wasm into the
  // host, which costs far more than a tight loop iteration does, so only sample
  // it once every so many boundaries. Overshooting the deadline by that many
  // iterations is a few microseconds of work.
  if (++runtime->warp_check_counter < CATNIP_WARP_CHECK_INTERVAL)
    return CATNIP_FALSE;

  runtime->warp_check_counter = 0;

  return catnip_import_perf_time() >= runtime->tick_deadline;
}

void catnip_runtime_start_threads(catnip_runtime *runtime, catnip_sprite *sprite, catnip_thread_fnptr entrypoint, catnip_list *threadList) {

  catnip_target *target = sprite->target;

  while (target != CATNIP_NULL) {

    catnip_thread *newThread = catnip_thread_new(target, entrypoint);

    if (threadList != CATNIP_NULL) {
      CATNIP_LIST_ADD(threadList, catnip_thread*, newThread);
      catnip_thread_ref(newThread);
    }

    target = target->next_sprite;
  }
}

