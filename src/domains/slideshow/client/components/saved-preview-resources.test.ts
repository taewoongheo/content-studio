import test from "node:test";
import assert from "node:assert/strict";
import type { EditorDocument } from "../../editor/types";
import { createSavedPreviewResources } from "./saved-preview-resources";
const document = {slides:[]} as unknown as EditorDocument;
test("covers and expanded previews share document reads, refresh by version and release requests on close",async()=>{
  let calls=0;const signals:AbortSignal[]=[];
  const resources=createSavedPreviewResources(async(_id,signal)=>{calls++;signals.push(signal!);return document;});
  const source={id:"post",updatedAt:"v1"};
  assert.equal(resources.read(source),resources.read(source));
  await resources.read(source);assert.equal(calls,1);
  await resources.read({...source,updatedAt:"v2"});assert.equal(calls,2);
  resources.clear();assert.ok(signals.every(signal=>signal.aborted));
  await resources.read(source);assert.equal(calls,3,"cleared resources remain reusable after Strict Mode cleanup");
});
test("failed document reads are retryable and retained documents are bounded",async()=>{
  let calls=0;
  const resources=createSavedPreviewResources(async()=>{if(++calls===1)throw Error("failure");return document;});
  const source={id:"post",updatedAt:"v1"};
  await assert.rejects(()=>resources.read(source));await resources.read(source);
  for(let i=0;i<21;i++)await resources.read({id:String(i),updatedAt:"v1"});
  await resources.read(source);assert.equal(calls,24,"oldest resolved document is evicted");
});
test("renders run at most two at a time and abandoned queued renders are skipped",async()=>{
  const resources=createSavedPreviewResources();
  let active=0,max=0,executed=0;
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  const controller=new AbortController();
  const render=()=>resources.render(controller.signal,async()=>{executed++;active++;max=Math.max(max,active);await gate;active--;});
  const first=render(),second=render(),third=render();
  await Promise.resolve();assert.equal(executed,2);controller.abort();release();
  await Promise.all([first,second]);await assert.rejects(()=>third);
  assert.equal(max,2);assert.equal(executed,2);
});
