type Task = { start: () => void };
type Queue = { active: boolean; tasks: Task[] };
const services = globalThis as typeof globalThis & { contentStudioRenderQueue?: Queue };
const queue = services.contentStudioRenderQueue ??= { active: false, tasks: [] };
function drain() {
  if (!queue.active) queue.tasks.shift()?.start();
}

/** FIFO with immediate removal of cancelled waiters, releasing captured documents and media. */
export function serializePreview<T>(render: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    let waiting = true;
    const detach = () => signal?.removeEventListener("abort", abort);
    const task: Task = { start: () => {
      waiting = false; detach(); queue.active = true;
      void Promise.resolve().then(render).then(resolve, reject).finally(() => { queue.active = false; drain(); });
    } };
    const abort = () => {
      if (!waiting) return; // Running work observes the same signal and performs its own cleanup.
      waiting = false; detach();
      const index = queue.tasks.indexOf(task); if (index >= 0) queue.tasks.splice(index, 1);
      reject(signal!.reason);
    };
    queue.tasks.push(task); signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    drain();
  });
}
