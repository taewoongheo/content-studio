import { useEffect, useState } from "react";
import { requestStageReport } from "@/domains/content-production/client/stage-report";
import { reportSourceKey } from "@/domains/content-production/domain/report/model";
import { productionSteps, type WorkDetail } from "@/domains/content-production/domain/contracts";
import { createDetailPrefetch } from "../../model/detail-prefetch";

/** Display report preparation starts independently of whether a node's panel is open. */
export function useDetailReportPrefetch(details: Record<string, WorkDetail>) {
  const [worker] = useState(() => createDetailPrefetch(requestStageReport));
  const requests = JSON.stringify(Object.entries(details).flatMap(([id, detail]) =>
    productionSteps.flatMap(({id: step}) => {
      const context = detail[step];
      const source = reportSourceKey(detail,step);
      return context && context.state !== "pending" && !!source ? [{id,step,source}] : [];
    })));
  useEffect(() => {
    const timer = setTimeout(() => worker.update(JSON.parse(requests)), 1500);
    return () => clearTimeout(timer);
  },[requests, worker]);
  useEffect(() => () => worker.stop(),[worker]);
}
