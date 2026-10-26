import type { ProductionStep } from "@/domains/content-production/domain/contracts";
import type { requestDisplayTranslation } from "@/domains/content-production/client";

type Item = {id: string; step: ProductionStep; source: string};
type Job = {source: string; controller: AbortController};
/** Keeps background viewers alive when detail panels close; the server shares sentence work. */
export function createDetailPrefetch(request: typeof requestDisplayTranslation) {
  const active = new Map<string,Job>(), finished = new Map<string,string>();
  return {
    update(items: Item[]) {
      const wanted = new Map(items.map(item => [`${item.id}:${item.step}`,item]));
      for (const [key,job] of active) {
        if (wanted.get(key)?.source !== job.source) { job.controller.abort(); active.delete(key); }
      }
      for (const key of finished.keys()) if (!wanted.has(key)) finished.delete(key);
      for (const [key,item] of wanted) {
        if (active.get(key)?.source === item.source || finished.get(key) === item.source) continue;
        const job = {source:item.source,controller:new AbortController()};
        active.set(key,job);
        void request(item.id,item.step,item.source,job.controller.signal,()=>{}).then(()=>{
          if (active.get(key) === job) finished.set(key,item.source);
        }).catch(()=>{
          // The detail panel offers retry; don't loop background failures on unrelated saves.
          if (active.get(key) === job && !job.controller.signal.aborted) finished.set(key,item.source);
        }).finally(()=>{ if (active.get(key) === job) active.delete(key); });
      }
    },
    stop() { for(const job of active.values())job.controller.abort(); active.clear(); finished.clear(); },
  };
}
