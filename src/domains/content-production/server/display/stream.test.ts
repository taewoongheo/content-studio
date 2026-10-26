import test from "node:test";
import assert from "node:assert/strict";
import { streamDisplayTranslation, translationGroups } from "./stream";

test("short fields are shown before a slow analysis and failures stay scoped to their section",async()=>{
  let finish!: (value:Record<string,unknown>)=>void;
  const waiting=new Promise<Record<string,unknown>>(resolve=>{finish=resolve;});
  const source={analysis:"Long analysis.",message:"Train consistently",presentation:"Cards",research:[{finding:"A question"}]};
  const response=streamDisplayTranslation(source,new AbortController().signal,async group=>{
    if("analysis" in group)return waiting;
    if("research" in group)throw new Error("Research translation failed");
    return {message:"꾸준히 운동한다",presentation:"카드"};
  });
  const reader=response.body!.getReader(),decoder=new TextDecoder();
  const first=JSON.parse(decoder.decode((await reader.read()).value));
  assert.equal(first.field,"message");assert.equal(first.translated,"꾸준히 운동한다");
  finish({analysis:"긴 분석"});
  let remaining="";
  while(true){const next=await reader.read();if(next.done)break;remaining+=decoder.decode(next.value);}
  const events=remaining.trim().split("\n").map(line=>JSON.parse(line));
  assert.ok(events.some(event=>event.field==="analysis" && event.translated==="긴 분석"));
  assert.ok(events.some(event=>event.field==="research" && event.error==="Research translation failed"));
  assert.equal(events.at(-1).type,"done");
  assert.deepEqual(source.message,"Train consistently");
  assert.deepEqual(translationGroups(source)[0],{message:source.message,presentation:source.presentation});
});
test("disconnecting the stream aborts pending section translations",async()=>{
  let worker!:AbortSignal;
  const response=streamDisplayTranslation({analysis:"Pending"},new AbortController().signal,async(_source,signal)=>{
    worker=signal!;
    return new Promise((_resolve,reject)=>worker.addEventListener("abort",()=>reject(worker.reason),{once:true}));
  });
  await response.body!.cancel();assert.equal(worker.aborted,true);
});
