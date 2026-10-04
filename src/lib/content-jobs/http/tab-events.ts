import type { ContentJobRegistry } from "../workflow/registry";

export function projectTabEvents(registry: ContentJobRegistry, signal: AbortSignal) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = () => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(registry.tabs())}\n\n`)); }
        catch { cleanup(); }
      };
      const unsubscribe = registry.subscribeTabs(send);
      const abort = () => {
        if (closed) return;
        cleanup();
        try { controller.close(); } catch { /* Already cancelled. */ }
      };
      cleanup = () => { closed = true; unsubscribe(); signal.removeEventListener("abort", abort); };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort(); else send();
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
