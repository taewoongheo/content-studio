import { subscribeVideoTabs, videoTabs } from "@/domains/video/server/service";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";

export function listOpenProjectTabs() {
  return [...contentJobRegistry.tabs(), ...videoTabs()];
}

export function projectTabEvents(signal: AbortSignal) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = () => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(listOpenProjectTabs())}\n\n`)); }
        catch { cleanup(); }
      };
      const unsubscribe = contentJobRegistry.subscribeTabs(send);
      const unsubscribeVideo = subscribeVideoTabs(send);
      const abort = () => {
        if (closed) return;
        cleanup();
        try { controller.close(); } catch { /* Already cancelled. */ }
      };
      cleanup = () => { closed = true; unsubscribe(); unsubscribeVideo(); signal.removeEventListener("abort", abort); };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort(); else send();
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
