import { useEffect, useState } from "react";
import { requestDisplayTranslation } from "@/domains/content-production/client";
import { displayContentKey } from "@/domains/content-production/domain/display";
import { productionSteps, type ProductionStep, type Row, type WorkDetail } from "@/domains/content-production/domain/contracts";

/** Korean projections for completed canvas results; canonical details stay untouched. */
export function useTranslatedDetails(details: Record<string, WorkDetail>) {
  const [views, setViews] = useState<Record<string, { source: string; value: Row }>>({});
  const [error, setError] = useState("");
  const requests = JSON.stringify(Object.entries(details).flatMap(([id, detail]) =>
    productionSteps.flatMap(({ id: step }) => {
      const context = detail[step];
      return context?.state === "completed" ? [{ id, step, source: displayContentKey(context) }] : [];
    })));
  useEffect(() => {
    let active = true;
    const items = JSON.parse(requests) as Array<{ id: string; step: ProductionStep; source: string }>;
    void Promise.all(items.map(async item => {
      const value = await requestDisplayTranslation(item.id, item.step, item.source);
      if (!active) return;
      setViews(previous => ({ ...previous, [`${item.id}:${item.step}`]: { source: item.source, value } }));
    })).then(() => { if (active) setError(""); }).catch(cause => {
      if (active) setError(`일부 결과의 한국어 번역에 실패했습니다. 영어 원문을 표시합니다. ${cause instanceof Error ? cause.message : ""}`);
    });
    return () => { active = false; };
  }, [requests]);
  const translated = Object.fromEntries(Object.entries(details).map(([id, detail]) => {
    const view = { ...detail };
    for (const { id: step } of productionSteps) {
      const context = detail[step], cached = views[`${id}:${step}`];
      if (context && cached?.source === displayContentKey(context)) view[step] = { ...context, ...cached.value };
    }
    return [id, view];
  }));
  return { details: translated, error };
}
