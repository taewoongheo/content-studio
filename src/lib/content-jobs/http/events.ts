import type { ContentJobSnapshot } from "../domain/types";
import type { ContentJobRegistry } from "../workflow/registry";

export function contentJobEvents(
  registry: ContentJobRegistry,
  jobId: string,
  signal: AbortSignal,
) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe = () => {};
      const send = (snapshot: ContentJobSnapshot) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`),
          );
        } catch {
          cleanup();
        }
      };

      const abort = () => {
        if (closed) return;
        cleanup();
        try {
          controller.close();
        } catch {
          // The consumer may have already closed or cancelled the stream.
        }
      };
      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        signal.removeEventListener("abort", abort);
      };
      unsubscribe = registry.subscribe(jobId, send, () => {
        if (!closed) { try { controller.enqueue(encoder.encode("event: closed\ndata: {}\n\n")); } catch { /* Already cancelled. */ } }
        abort();
      });
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      send(registry.get(jobId));
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
