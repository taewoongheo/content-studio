const state = globalThis as typeof globalThis & { contentStudioProjectListeners?: Set<() => void> };
const listeners = state.contentStudioProjectListeners ??= new Set<() => void>();

export function notifyProjectsChanged() {
  for (const listener of listeners) listener();
}

export function contentProjectEvents(signal: AbortSignal) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = () => {
        if (closed) return;
        try { controller.enqueue(encoder.encode("data: changed\n\n")); }
        catch { cleanup(); }
      };
      const abort = () => {
        if (closed) return;
        cleanup();
        try { controller.close(); } catch { /* Already cancelled. */ }
      };
      cleanup = () => {
        if (closed) return;
        closed = true;
        listeners.delete(send);
        signal.removeEventListener("abort", abort);
      };
      listeners.add(send);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      else send();
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no",
  } });
}
