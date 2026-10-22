import type { ChangeEvent } from "../domain/contracts";
const globalState = globalThis as typeof globalThis & { productionListeners?: Set<(event: ChangeEvent) => void> };
const listeners = globalState.productionListeners ??= new Set<(event: ChangeEvent) => void>();
export function publishChange(event: ChangeEvent) { for (const listener of listeners) listener(event); }
export function productionEvents(signal: AbortSignal) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: ChangeEvent) => { if (!closed) { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch { cleanup(); } } };
      const close = () => { cleanup(); try { controller.close(); } catch {} };
      const heartbeat = setInterval(() => { if (!closed) { try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { cleanup(); } } }, 15000);
      cleanup = () => { if (closed) return; closed = true; listeners.delete(send); clearInterval(heartbeat); signal.removeEventListener("abort", close); };
      listeners.add(send); signal.addEventListener("abort", close, { once: true });
      if (signal.aborted) close(); else controller.enqueue(encoder.encode(": connected\n\n"));
    }, cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
