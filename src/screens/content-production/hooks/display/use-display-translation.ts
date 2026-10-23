import { useEffect, useState } from "react";
import { productionAction } from "@/domains/content-production/client";
import { displayContent } from "@/domains/content-production/domain/display";
import type { ProductionStep, Row } from "@/domains/content-production/domain/contracts";

export function useDisplayTranslation(id: string, step: ProductionStep, context: Row | undefined | null, enabled: boolean) {
  const sourceKey = context ? JSON.stringify(displayContent(context)) : "";
  const key = `${id}:${step}:${sourceKey}`;
  const [result, setResult] = useState<{ key: string; value?: Row; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || !sourceKey || sourceKey === "{}") return;
    let active = true;
    // Avoid launching a translation for each intermediate save in a burst.
    const timer = setTimeout(() => {
      productionAction({ action: "translate_display", id, step }).then(response => {
        if (!active) return;
        if (JSON.stringify(response.source) !== sourceKey) {
          setResult({ key, error: "내용이 갱신되었습니다. 다시 번역해 주세요." });
          return;
        }
        setResult({ key, value: response.translated });
      }).catch(error => {
        if (active) setResult({ key, error: error instanceof Error ? error.message : "번역 실패" });
      });
    }, 600);
    return () => { active = false; clearTimeout(timer); };
  }, [id, step, key, sourceKey, enabled, attempt]);
  const current = result?.key === key ? result : null;
  return { translated: current?.value, error: current?.error, loading: enabled && !!sourceKey && sourceKey !== "{}" && !current, retry: () => setAttempt(value => value + 1) };
}
