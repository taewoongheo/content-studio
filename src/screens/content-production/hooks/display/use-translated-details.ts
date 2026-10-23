import { useEffect, useState } from "react";
import { productionAction } from "@/domains/content-production/client";
import { displayContent } from "@/domains/content-production/domain/display";
import type { Row, WorkDetail } from "@/domains/content-production/domain/contracts";

/** Korean projections for completed canvas results; canonical details stay untouched. */
export function useTranslatedDetails(details: Record<string, WorkDetail>) {
  const [views, setViews] = useState<Record<string, { source: string; value: Row }>>({});
  const [error, setError] = useState("");
  const requests = JSON.stringify(Object.entries(details).flatMap(([id, detail]) =>
    (["analysis", "production"] as const).flatMap(step => {
      const context = detail[step];
      return context?.state === "completed" ? [{ id, step, source: JSON.stringify(displayContent(context)) }] : [];
    })));
  useEffect(() => {
    let active = true;
    const items = JSON.parse(requests) as Array<{ id: string; step: "analysis" | "production"; source: string }>;
    void Promise.all(items.map(async item => {
      const response = await productionAction({ action: "translate_display", id: item.id, step: item.step });
      if (!active || JSON.stringify(response.source) !== item.source) return;
      setViews(previous => ({ ...previous, [`${item.id}:${item.step}`]: { source: item.source, value: response.translated } }));
    })).then(() => { if (active) setError(""); }).catch(cause => {
      if (active) setError(`일부 결과의 한국어 번역에 실패했습니다. 영어 원문을 표시합니다. ${cause instanceof Error ? cause.message : ""}`);
    });
    return () => { active = false; };
  }, [requests]);
  const translated = Object.fromEntries(Object.entries(details).map(([id, detail]) => {
    const view = { ...detail };
    for (const step of ["analysis", "production"] as const) {
      const context = detail[step], cached = views[`${id}:${step}`];
      if (context && cached?.source === JSON.stringify(displayContent(context))) view[step] = { ...context, ...cached.value };
    }
    return [id, view];
  }));
  return { details: translated, error };
}
