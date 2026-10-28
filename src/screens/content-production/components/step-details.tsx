"use client";
import { useEffect,useState } from "react";
import { StatusIcon } from "./workflow/status-icon";
import { useStageReport } from "../hooks/display/use-stage-report";
import { StageReportView } from "./details/report/stage-report-view";
import type { ProductionStep,WorkDetail } from "@/domains/content-production/domain/contracts";
import { productionSteps } from "../model/task-controls";

export function StepDetails({id,step,updated,write,onClose,readWork}:{
  id:string;step:ProductionStep;updated:string;write:number;onClose:()=>void;readWork:(id:string)=>Promise<WorkDetail>;
}) {
  const [detail,setDetail]=useState<WorkDetail|null>(null),[error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    readWork(id).then(value=>{if(active){setDetail(value);setError("");}}).catch(()=>{if(active)setError("단계 결과를 불러오지 못했습니다.");});
    return()=>{active=false;};
  },[id,step,updated,write,readWork]);
  const current=detail?.task.id===id?detail:null;
  const context=current?.[step];
  const report=useStageReport(id,step,current);
  const incomplete=context&&["failed","stopped"].includes(String(context.state));
  return <section className="production-details p-5" aria-label="단계 상세">
    <header className="flex items-start justify-between gap-4 border-b pb-4">
      <h3 className="flex items-center gap-2 font-semibold"><StatusIcon state={String(context?.state??"pending")} size={16}/>{productionSteps.find(value=>value.id===step)?.label}</h3>
      <button className="production-button" onClick={onClose}>닫기</button>
    </header>
    {error&&<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {incomplete&&<p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs leading-6 text-muted-foreground">이 단계는 아직 완료되지 않았습니다. 저장된 결과와 남은 작업을 기준으로 정리합니다.</p>}
    <div className="mt-5">
      {report.report?<StageReportView report={report.report}/>:report.error?<div role="alert" className="space-y-3 text-sm text-muted-foreground">
        <p>결과를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.</p><button className="production-button" onClick={report.retry}>다시 정리</button>
      </div>:<p role="status" className="text-sm leading-7 text-muted-foreground">{!current?"결과를 불러오는 중…":report.hasContent?"정리 중...":context?.state==="running"?"제작 중입니다. 내용이 저장되면 정리된 결과가 표시됩니다.":"이 단계에 저장된 결과가 아직 없습니다."}</p>}
    </div>
  </section>;
}
