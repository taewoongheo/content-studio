import { useEffect,useState } from "react";
import { requestStageReport } from "@/domains/content-production/client/stage-report";
import { reportSourceKey,type StageReport } from "@/domains/content-production/domain/report/model";
import type { ProductionStep,WorkDetail } from "@/domains/content-production/domain/contracts";
export function useStageReport(id:string,step:ProductionStep,detail:WorkDetail|null) {
  const key=detail?reportSourceKey(detail,step):"";
  const [result,setResult]=useState<{key:string;report?:StageReport;error?:string}>(),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!key)return;
    let active=true;const controller=new AbortController();
    const timer=setTimeout(()=>{
      requestStageReport(id,step,key,controller.signal).then(report=>{if(active)setResult({key,report});}).catch(()=>{if(active)setResult({key,error:"결과를 정리하지 못했습니다."});});
    },500);
    return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[id,step,key,attempt]);
  return {report:result?.key===key?result.report:undefined,error:result?.key===key?result.error:undefined,loading:!!key&&result?.key!==key,hasContent:!!key,retry:()=>{setResult(undefined);setAttempt(value=>value+1);}};
}
