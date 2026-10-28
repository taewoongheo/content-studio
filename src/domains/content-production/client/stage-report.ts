import { createReportRequests } from "./report-requests";
import { createTranslationQueue } from "./translation-queue";
import { editorLoadPriority } from "@/domains/workspace/client/editor-load-priority";
import { stageReportSchema, type StageReport } from "../domain/report/model";
import type { ProductionStep } from "../domain/contracts";
const queue=createTranslationQueue();
editorLoadPriority.subscribe(queue.setPaused);
const request=createReportRequests((id,step,sourceKey,signal)=>{
  return queue.run(signal,async requestSignal=>{
    const response=await fetch("/api/content-production",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"stage_report",id,step,sourceKey}),signal:requestSignal});
    if(!response.ok)throw new Error("보고서를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    const result=await response.json();
    if(result.sourceKey!==sourceKey)throw new Error("단계 내용이 갱신되었습니다.");
    return stageReportSchema.parse(result.report);
  });
});

export function requestStageReport(id:string,step:ProductionStep,sourceKey:string,signal?:AbortSignal):Promise<StageReport>{return request(id,step,sourceKey,signal);}
