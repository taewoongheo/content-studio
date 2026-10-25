import test from "node:test";
import assert from "node:assert/strict";
import { createDetailPrefetch } from "./detail-prefetch";
import type { requestDisplayTranslation } from "@/domains/content-production/client";

test("details prefetch without a selected node, share unchanged work and only cancel replaced/removed drafts",async()=>{
  const calls:Array<{id:string;source:string;signal:AbortSignal;finish:()=>void}>=[];
  const request:typeof requestDisplayTranslation=async(id,_step,source,signal)=>new Promise(resolve=>{
    calls.push({id,source,signal:signal!,finish:()=>resolve({analysis:"분석"})});
  });
  const worker=createDetailPrefetch(request);
  const a={id:"one",step:"analysis" as const,source:'{"analysis":"First"}'};
  const b={id:"two",step:"analysis" as const,source:'{"analysis":"Second"}'};
  worker.update([a,b]);assert.equal(calls.length,2,"no detail panel selection is needed");
  worker.update([a,b]);assert.equal(calls.length,2);
  worker.update([{...a,source:'{"analysis":"Updated"}'},b]);
  assert.equal(calls[0].signal.aborted,true);assert.equal(calls[1].signal.aborted,false);assert.equal(calls.length,3);
  calls[0].finish();calls[2].finish();await new Promise(resolve=>setImmediate(resolve));
  worker.update([{...a,source:'{"analysis":"Updated"}'},b]);assert.equal(calls.length,3);
  worker.update([]);assert.equal(calls[1].signal.aborted,true);
  worker.stop();calls[1].finish();
});
test("background failures do not loop on unrelated updates and source changes can retry",async()=>{
  let calls=0;
  const worker=createDetailPrefetch(async()=>{calls++;throw new Error("Translation unavailable");});
  const item={id:"one",step:"analysis" as const,source:'{"message":"Train"}'};
  worker.update([item]);await new Promise(resolve=>setImmediate(resolve));
  worker.update([item]);assert.equal(calls,1);
  worker.update([{...item,source:'{"message":"Train again"}'}]);assert.equal(calls,2);
  worker.stop();
});
