import type { ContentJobRegistry } from "./registry";
import type { ContentJobSnapshot } from "./types";

export function contentJobEvents(
  registry: ContentJobRegistry,
  jobId: string,
  signal: AbortSignal,
) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (snapshot: ContentJobSnapshot) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`),
        );
      };
      const unsubscribe = registry.subscribe(jobId, send);
      const abort = () => {
        cleanup();
        controller.close();
      };
      cleanup = () => {
        unsubscribe();
        signal.removeEventListener("abort", abort);
      };
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
