import { useEffect, useState } from "react";
import { requestDisplayTranslation } from "@/domains/content-production/client";
import { displayContent, displayContentKey } from "@/domains/content-production/domain/display";
import type { ProductionStep, Row } from "@/domains/content-production/domain/contracts";

type FieldState = { source: string; value?: unknown; error?: string };
export function useDisplayTranslation(id: string, step: ProductionStep, context: Row | undefined | null, enabled: boolean) {
  const sourceKey=displayContentKey(context),scope=`${id}:${step}`;
  const [results,setResults]=useState<Record<string,FieldState>>({});
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!enabled || !sourceKey || sourceKey==="{}")return;
    let active=true;
    const source=JSON.parse(sourceKey) as Row;
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      requestDisplayTranslation(id,step,sourceKey,controller.signal,event=>{
        if(!active)return;
        setResults(previous=>({...previous,[`${scope}:${event.field}`]:{
          source:JSON.stringify(event.source),...(event.error?{error:event.error}:{value:event.translated}),
        }}));
      }).catch(error=>{
        if(!active)return;
        setResults(previous=>{
          const next={...previous};
          for(const [field,value] of Object.entries(source)) {
            const key=`${scope}:${field}`,original=JSON.stringify(value);
            if(next[key]?.source===original && "value" in next[key])continue;
            next[key]={source:original,error:error instanceof Error?error.message:"번역 실패"};
          }
          return next;
        });
      });
    },200);
    return ()=>{active=false;clearTimeout(timer);controller.abort();};
  },[id,step,scope,sourceKey,enabled,attempt]);
  const translated: Row={},pendingFields=new Set<string>(),errors:string[]=[];
  for(const [field,value] of Object.entries(context?displayContent(context):{})){
    const result=results[`${scope}:${field}`];
    if(result?.source!==JSON.stringify(value)){pendingFields.add(field);continue;}
    if(result.error)errors.push(result.error);
    else translated[field]=result.value;
  }
  return {translated:Object.keys(translated).length?translated:undefined,error:errors[0],
    loading:enabled && pendingFields.size>0,pendingFields,
    retry:()=>{ setResults(previous=>Object.fromEntries(Object.entries(previous).filter(([key,value])=>!key.startsWith(`${scope}:`) || !value.error))); setAttempt(value=>value+1); }};
}
