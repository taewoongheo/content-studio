"use client";
import { useCallback,useEffect,useState } from "react";
import { fetchProduction,productionAction,type ProductionSnapshot } from "@/domains/content-production/client";
export function useSpy() {
  const [data,setData]=useState<ProductionSnapshot|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const reload=useCallback(async()=>{try{setData(await fetchProduction<ProductionSnapshot>());}catch(e){setError(e instanceof Error?e.message:"조회 실패");}},[]);
  useEffect(()=>{queueMicrotask(()=>void reload());const events=new EventSource("/api/content-production");events.onmessage=()=>void reload();events.onopen=()=>void reload();return()=>events.close();},[reload]);
  const act=async(input:Record<string,unknown>)=>{setBusy(true);setError("");try{await productionAction(input);await reload();return true;}catch(e){setError(e instanceof Error?e.message:"처리 실패");return false;}finally{setBusy(false);}};
  return {data,error,busy:busy||!!data?.spy.running,act};
}
