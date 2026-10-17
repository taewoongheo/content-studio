const services = globalThis as typeof globalThis & { contentStudioPreviewQueue?: Promise<void> };

/** Cancel queued callers immediately, while retaining their place until earlier work finishes. */
export function serializePreview<T>(render: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const previous = services.contentStudioPreviewQueue ?? Promise.resolve();
  let started = false;
  const operation = previous.then(() => { signal?.throwIfAborted(); started = true; return render(); });
  services.contentStudioPreviewQueue = operation.then(() => {}, () => {});
  if (!signal) return operation;
  return new Promise<T>((resolve, reject) => {
    const abort = () => { if (!started) reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}
