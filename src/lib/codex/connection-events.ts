import type { CodexConnectionManager } from "./connection";
import type { CodexConnection } from "./types";

export function connectionEvents(
  manager: CodexConnectionManager,
  signal: AbortSignal,
) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (state: CodexConnection) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(state)}\n\n`),
        );
      };
      const unsubscribe = manager.subscribe(send);
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
      send(manager.snapshot());
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
