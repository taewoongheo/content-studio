import { editorLoadPriority } from "@/domains/workspace/client/editor-load-priority";
import { createTranslationQueue } from "./client/translation-queue";
import type { PerformanceRefresh } from "./domain/performance";
import type { ProductionStep, Row, WorkDetail, WorkItem } from "./domain/contracts";
export interface ProductionSnapshot {
  sampling: import("./domain/references/sampling").SamplingSettings;
  spy: {running:boolean;accounts:Record<string,{state:string;count:number;error?:string}>};
  publishedPosts: import("./domain/published-posts").PublishedPost[];
  tasks: WorkItem[];
  logs: Row[];
  planningLogs: Row[];
  externalReferences: Row[];
  referenceAccounts: Row[];
  visuals: Row[];
  sync: { running: boolean; report: PerformanceRefresh | null };
  configured: { apify: boolean };
}
export async function fetchProduction<T>(params = ""): Promise<T> {
  const response = await fetch(`/api/content-production${params}`, {
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body;
}
export async function productionAction(action: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch("/api/content-production", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
    signal,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body;
}
export const fetchWork = (id: string) =>
  fetchProduction<WorkDetail>(`?id=${encodeURIComponent(id)}`);

export type TranslationField = { field: string; source: unknown; translated?: unknown; error?: string };
const translationQueue = createTranslationQueue();
editorLoadPriority.subscribe(translationQueue.setPaused);

export function requestDisplayTranslation(id: string, step: ProductionStep, sourceKey: string,
  signal?: AbortSignal, onField?: (result: TranslationField) => void): Promise<Row> {
  return translationQueue.run(signal, requestSignal => translateDisplayRequest(id, step, sourceKey, requestSignal, onField));
}
async function translateDisplayRequest(id: string, step: ProductionStep, sourceKey: string,
  signal?: AbortSignal, onField?: (result: TranslationField) => void): Promise<Row> {
  if (!onField) {
    const response = await productionAction({ action: "translate_display", id, step }, signal) as { source: Row; translated: Row };
    if (JSON.stringify(response.source) !== sourceKey) throw new Error("내용이 갱신되었습니다. 다시 번역해 주세요.");
    return response.translated;
  }
  const response = await fetch("/api/content-production", {method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"translate_display",id,step,stream:true}),signal});
  if (!response.ok) throw new Error((await response.json()).error);
  if (!response.body) throw new Error("번역 응답 스트림이 없습니다.");
  const expected = JSON.parse(sourceKey), translated: Row = {};
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer="",done=false;
  const consume=(line:string)=>{
    if(!line.trim())return;
    const event=JSON.parse(line);
    if(event.type==="done"){done=true;return;}
    if(event.type!=="field" || !(event.field in expected))throw new Error("번역 응답 형식이 올바르지 않습니다.");
    if(JSON.stringify(expected[event.field])!==JSON.stringify(event.source))throw new Error("내용이 갱신되었습니다. 다시 번역해 주세요.");
    if(!event.error)translated[event.field]=event.translated;
    onField(event);
  };
  try {
    while(true){const next=await reader.read();if(next.done)break;buffer+=decoder.decode(next.value,{stream:true});
      const lines=buffer.split("\n");buffer=lines.pop()!;lines.forEach(consume);}
    buffer+=decoder.decode();if(buffer.trim())consume(buffer);
    if(!done)throw new Error("번역 응답이 중간에 끊겼습니다.");
    return translated;
  } finally { await reader.cancel().catch(()=>undefined); reader.releaseLock(); }
}
