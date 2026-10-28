import test from "node:test";
import assert from "node:assert/strict";
import { createReportRequests } from "./report-requests";
const report={headline:"결과",summary:"정리한 내용",sections:[],next_actions:[]};
test("opening and closing a panel shares the background report request and unchanged result",async()=>{
 let calls=0;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const request=createReportRequests(async(_id,_step,_source,signal)=>{calls++;await gate;signal.throwIfAborted();return report;});
 const controller=new AbortController();const panel=request('one','analysis','v1',controller.signal),background=request('one','analysis','v1');
 controller.abort();await assert.rejects(()=>panel);release();assert.deepEqual(await background,report);assert.equal(calls,1);
 assert.deepEqual(await request('one','analysis','v1'),report);assert.equal(calls,1);
 await request('one','analysis','v2');assert.equal(calls,2);
});
test("cancelled or failed report requests do not poison retries",async()=>{
 let calls=0;const request=createReportRequests(async()=>{if(++calls===1)throw Error('failed');return report;});
 await assert.rejects(()=>request('one','analysis','v1'));assert.deepEqual(await request('one','analysis','v1'),report);
 const controller=new AbortController();controller.abort();await assert.rejects(()=>request('one','analysis','v1',controller.signal));
});
