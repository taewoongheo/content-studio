import type { Row } from "../../domain/contracts";
import { translateDisplay } from "./translation";

/** Small fields share one call; long sections finish independently. */
export function translationGroups(source: Row): Row[] {
  const short: Row = {}, groups: Row[] = [];
  for (const [field,value] of Object.entries(source)) {
    if (typeof value === "string" && value.length <= 400 && !["analysis","review"].includes(field)) short[field]=value;
    else groups.push({[field]:value});
  }
  return Object.keys(short).length ? [short,...groups] : groups;
}
export function streamDisplayTranslation(source: Row, signal: AbortSignal, translate = translateDisplay) {
  const controller = new AbortController();
  const combined = AbortSignal.any([signal,controller.signal]);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(stream) {
      const send = (value: unknown) => { if (!combined.aborted) stream.enqueue(encoder.encode(JSON.stringify(value)+"\n")); };
      void Promise.allSettled(translationGroups(source).map(async group => {
        try {
          const translated = await translate(group,combined);
          for (const field of Object.keys(group)) send({type:"field",field,source:group[field],translated:translated[field]});
        } catch (error) {
          for (const field of Object.keys(group)) send({type:"field",field,source:group[field],error:error instanceof Error?error.message:"번역 실패"});
        }
      })).then(()=>{
        if (!controller.signal.aborted) { send({type:"done"}); stream.close(); }
      });
    },
    cancel() { controller.abort(new DOMException("Display closed","AbortError")); },
  });
  return new Response(body,{headers:{"Content-Type":"application/x-ndjson; charset=utf-8","Cache-Control":"no-store","X-Accel-Buffering":"no"}});
}
