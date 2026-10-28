import type { StageReport } from "../domain/report/model";
import type { ProductionStep } from "../domain/contracts";
type Request=(id:string,step:ProductionStep,key:string,signal:AbortSignal)=>Promise<StageReport>;
/** Background readers and an open panel share a request; closing either must not cancel the other. */
export function createReportRequests(request:Request) {
  const cache=new Map<string,StageReport>();
  const pending=new Map<string,{controller:AbortController;users:number;settled:boolean;promise:Promise<StageReport>}>();
  return async(id:string,step:ProductionStep,source:string,signal?:AbortSignal):Promise<StageReport>=>{
    signal?.throwIfAborted();const key=JSON.stringify([id,step,source]);
    if(cache.has(key))return cache.get(key)!;
    let job=pending.get(key);
    if(!job) {
      const controller=new AbortController();
      const created={controller,users:0,settled:false,promise:Promise.resolve(null as unknown as StageReport)};
      created.promise=Promise.resolve().then(()=>request(id,step,source,controller.signal)).then(report=>{
        controller.signal.throwIfAborted();cache.set(key,report);
        while(cache.size>30)cache.delete(cache.keys().next().value!);
        return report;
      }).finally(()=>{created.settled=true;if(pending.get(key)===created)pending.delete(key);});
      void created.promise.catch(()=>undefined);pending.set(key,created);job=created;
    }
    const current=job;current.users++;
    let abort!:()=>void;
    const cancelled=new Promise<never>((_,reject)=>{abort=()=>reject(signal?.reason??new DOMException("Report closed","AbortError"));signal?.addEventListener("abort",abort,{once:true});});
    try{if(signal?.aborted)abort();return await Promise.race([current.promise,cancelled]);}
    finally{signal?.removeEventListener("abort",abort);current.users--;if(!current.users&&!current.settled){current.controller.abort();if(pending.get(key)===current)pending.delete(key);}}
  };
}
