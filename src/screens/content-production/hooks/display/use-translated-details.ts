import { useEffect, useRef, useState } from "react";
import { requestCanvasTranslation, type CanvasTranslationRequest } from "@/domains/content-production/client";
import { displayContentKey, applyCanvasTranslation } from "@/domains/content-production/domain/display";
import { productionSteps, type Row, type WorkDetail } from "@/domains/content-production/domain/contracts";

type Views = Record<string, { source: string; value: Row }>;
type Batch = { controller: AbortController; items: CanvasTranslationRequest[] };
const itemKey = (item: CanvasTranslationRequest) => `${item.id}:${item.step}`;
/** Canvas summaries only; full drafts are translated by the selected detail panel. */
export function useTranslatedDetails(details: Record<string, WorkDetail>) {
  const [views, setViews] = useState<Views>({});
  const saved = useRef<Views>({});
  const batches = useRef(new Set<Batch>());
  const wanted = useRef(new Map<string, string>());
  const mounted = useRef(true);
  const [error, setError] = useState("");
  const requests = JSON.stringify(Object.entries(details).flatMap(([id, detail]) =>
    productionSteps.flatMap(({ id: step }) => {
      const context = detail[step];
      return context?.state === "completed" ? [{ id, step, source: displayContentKey(context, "canvas") }] : [];
    })));
  useEffect(() => {
    const all = JSON.parse(requests) as CanvasTranslationRequest[];
    wanted.current = new Map(all.map(item => [itemKey(item), item.source]));
    saved.current = Object.fromEntries(Object.entries(saved.current).filter(([key]) => wanted.current.has(key)));
    const current = (item: CanvasTranslationRequest) => wanted.current.get(itemKey(item)) === item.source;
    for (const batch of batches.current) {
      if (!batch.items.some(current)) { batch.controller.abort(); batches.current.delete(batch); }
    }
    const items = all.filter(item => item.source !== "{}" && saved.current[itemKey(item)]?.source !== item.source &&
      ![...batches.current].some(batch => batch.items.some(other => itemKey(other) === itemKey(item) && other.source === item.source)));
    if (!items.length) return;
    const timer = setTimeout(() => {
      const batch: Batch = { controller: new AbortController(), items };
      batches.current.add(batch);
      // New stages do not cancel still-needed summaries already being translated.
      void requestCanvasTranslation(items, batch.controller.signal).then(value => {
        if (!mounted.current || batch.controller.signal.aborted) return;
        const valid = Object.fromEntries(Object.entries(value).filter(([key, result]) => wanted.current.get(key) === result.source));
        if (!Object.keys(valid).length) return;
        saved.current = { ...saved.current, ...valid };
        setViews(saved.current); setError("");
      }).catch(cause => {
        if (mounted.current && !batch.controller.signal.aborted && batch.items.some(current))
          setError(`일부 결과의 한국어 번역에 실패했습니다. 영어 원문을 표시합니다. ${cause instanceof Error ? cause.message : ""}`);
      }).finally(() => batches.current.delete(batch));
    }, 100);
    return () => clearTimeout(timer);
  }, [requests]);
  useEffect(() => {
    mounted.current = true;
    const running = batches.current;
    return () => { mounted.current = false; for (const batch of running) batch.controller.abort(); running.clear(); };
  }, []);
  const translated = Object.fromEntries(Object.entries(details).map(([id, detail]) => {
    const view = { ...detail };
    for (const { id: step } of productionSteps) {
      const context = detail[step], cached = views[`${id}:${step}`];
      if (context && cached?.source === displayContentKey(context, "canvas")) view[step] = applyCanvasTranslation(context, cached.value);
    }
    return [id, view];
  }));
  return { details: translated, error };
}
