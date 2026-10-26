import { useEffect, useState } from "react";
import { requestDisplayTranslation } from "@/domains/content-production/client";
import { displayContentKey } from "@/domains/content-production/domain/display";
import { productionSteps, type WorkDetail } from "@/domains/content-production/domain/contracts";
import { createDetailPrefetch } from "../../model/detail-prefetch";

/** Detail translation starts independently of whether a node's panel is open. */
export function useDetailTranslationPrefetch(details: Record<string, WorkDetail>) {
  const [worker] = useState(() => createDetailPrefetch(requestDisplayTranslation));
  const requests = JSON.stringify(Object.entries(details).flatMap(([id, detail]) =>
    productionSteps.flatMap(({id: step}) => {
      const context = detail[step];
      const source = displayContentKey(context);
      return context && context.state !== "pending" && source !== "{}" ? [{id,step,source}] : [];
    })));
  useEffect(() => {
    const timer = setTimeout(() => worker.update(JSON.parse(requests)), 300);
    return () => clearTimeout(timer);
  },[requests, worker]);
  useEffect(() => () => worker.stop(),[worker]);
}
