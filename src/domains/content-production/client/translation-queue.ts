const PREEMPTED = new Error("Foreground editor load has priority");
type Job = {
  run: (signal: AbortSignal) => Promise<unknown>;
  resolve: (result: unknown) => void;
  reject: (error: unknown) => void;
  controller?: AbortController;
  settled: boolean;
  cleanup: () => void;
};

/** Limit HTTP streams, not just CLI workers. Preempted callers wait for an automatic retry. */
export function createTranslationQueue(limit = 2) {
  const pending: Job[] = [], active = new Set<Job>();
  let paused = false;
  function settle(job: Job, error: unknown, result?: unknown) {
    if (job.settled) return;
    job.settled = true;
    job.cleanup();
    if (error !== undefined) job.reject(error);
    else job.resolve(result);
  }
  function pump() {
    while (!paused && active.size < limit && pending.length) {
      const job = pending.shift()!;
      if (job.settled) continue;
      const controller = new AbortController();
      job.controller = controller;
      active.add(job);
      void Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return job.run(controller.signal);
      }).then(result => settle(job, undefined, result)).catch(error => {
        if (!job.settled && controller.signal.reason === PREEMPTED) pending.push(job);
        else settle(job, error);
      }).finally(() => {
        active.delete(job);
        job.controller = undefined;
        pump();
      });
    }
  }
  return {
    run<T>(signal: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const job: Job = { run, resolve: value => resolve(value as T), reject, settled: false, cleanup: () => {} };
        const abort = () => {
          const reason = signal?.reason ?? new DOMException("Translation cancelled", "AbortError");
          job.controller?.abort(reason);
          const index = pending.indexOf(job);
          if (index >= 0) pending.splice(index, 1);
          settle(job, reason);
        };
        job.cleanup = () => signal?.removeEventListener("abort", abort);
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) { abort(); return; }
        pending.push(job);
        pump();
      });
    },
    setPaused(value: boolean) {
      paused = value;
      if (paused) for (const job of active) job.controller?.abort(PREEMPTED);
      else pump();
    },
  };
}
