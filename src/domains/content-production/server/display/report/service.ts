import { createHash } from "node:crypto";
import type { StageReport } from "../../../domain/report/model";
import type { ReportInput } from "./input";
import { generateStageReport, validateStageReport } from "./generate";
import { loadReportCache, saveReportCache } from "./cache";
type Generate=(input:ReportInput,signal:AbortSignal)=>Promise<StageReport>;
type Job={controller:AbortController;users:number;settled:boolean;promise:Promise<StageReport>};
export function createStageReportService(generate:Generate,options:{cache?:Map<string,StageReport>;onCacheChange?:(cache:Map<string,StageReport>)=>void}={}) {
  const cache=options.cache??new Map<string,StageReport>(),pending=new Map<string,Job>();
  let running=0;
  const queue=new Set<()=>void>();
  async function limited(input:ReportInput,signal:AbortSignal) {
    signal.throwIfAborted();
    await new Promise<void>((resolve,reject)=>{
      const cancel=()=>{queue.delete(wake);reject(signal.reason);};
      const wake=()=>{if(running>=2)return;queue.delete(wake);signal.removeEventListener("abort",cancel);running++;resolve();};
      signal.addEventListener("abort",cancel,{once:true});queue.add(wake);wake();
    });
    try{signal.throwIfAborted();return await generate(input,signal);}finally{running--;for(const wake of queue)wake();}
  }
  return async(input:ReportInput,signal?:AbortSignal):Promise<StageReport>=>{
    signal?.throwIfAborted();
    const serialized=JSON.stringify(input);
    if(serialized.length>200000)throw new Error("정리할 내용이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
    const key=createHash("sha256").update(JSON.stringify(["stage-report-v2","gpt-6-luna",input])).digest("hex");
    const cached=cache.get(key);
    if(cached){cache.delete(key);cache.set(key,cached);return structuredClone(cached);}
    let job=pending.get(key);
    if(!job) {
      const controller=new AbortController();
      job={controller,users:0,settled:false,promise:Promise.resolve(null as unknown as StageReport)};
      const current=job;
      job.promise=Promise.resolve().then(async()=>{
        const combined=AbortSignal.any([controller.signal,AbortSignal.timeout(180000)]);
        const report=validateStageReport(await limited(input,combined),input);
        combined.throwIfAborted();cache.set(key,report);
        let size=[...cache.values()].reduce((total,value)=>total+JSON.stringify(value).length,0);
        while(cache.size>80||size>1000000){const oldest=cache.keys().next().value!;size-=JSON.stringify(cache.get(oldest)).length;cache.delete(oldest);}
        options.onCacheChange?.(cache);
        return report;
      }).finally(()=>{current.settled=true;if(pending.get(key)===current)pending.delete(key);});
      void job.promise.catch(()=>undefined);pending.set(key,job);
    }
    const current=job;current.users++;
    let abort!:()=>void;
    const cancelled=new Promise<never>((_,reject)=>{abort=()=>reject(signal?.reason??new DOMException("Report closed","AbortError"));signal?.addEventListener("abort",abort,{once:true});});
    try{if(signal?.aborted)abort();return structuredClone(await Promise.race([current.promise,cancelled]));}
    finally{signal?.removeEventListener("abort",abort);current.users--;if(!current.users&&!current.settled){current.controller.abort();if(pending.get(key)===current)pending.delete(key);}}
  };
}
const shared=globalThis as typeof globalThis&{stageReportServiceV2?:ReturnType<typeof createStageReportService>};
export const readStageReport=(shared.stageReportServiceV2??=createStageReportService(generateStageReport,{cache:loadReportCache(),onCacheChange:saveReportCache}));
