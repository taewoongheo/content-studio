import test from "node:test";
import assert from "node:assert/strict";
import { createStageReportService } from "../service";
import { validateStageReport } from "../generate";
import type { ReportInput } from "../input";
const report={headline:"등 운동 비교",summary:"운동 선택 기준을 정리했습니다.",sections:[{title:"선택 이유",paragraphs:["실제 사례를 비교했습니다."],items:[]}],next_actions:[]};
const input:ReportInput={stage:"analysis",state:"completed",results:{analysis:"A comparison",content:{hook:"BUILD YOUR BACK"}},evidence:[],error:undefined};
test("report callers share model work, survive panel closure, cache only display output and invalidate on real changes",async()=>{
 let calls=0;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const read=createStageReportService(async(_input,signal)=>{calls++;await gate;signal.throwIfAborted();return report;});
 const controller=new AbortController();const closed=read(input,controller.signal),background=read(input);
 controller.abort();await assert.rejects(()=>closed);release();assert.deepEqual(await background,report);assert.equal(calls,1);
 assert.deepEqual(await read(input),report);assert.equal(calls,1);
 await read({...input,results:{analysis:"Changed"}});assert.equal(calls,2);
 assert.equal(input.results.analysis,"A comparison");
});
test("display report workers are limited to two and failures can retry",async()=>{
 let active=0,max=0;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const read=createStageReportService(async()=>{active++;max=Math.max(max,active);await gate;active--;return report;});
 const work=[0,1,2,3].map(index=>read({...input,results:{index}}));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(active,2);release();await Promise.all(work);assert.equal(max,2);
 let calls=0;const retry=createStageReportService(async()=>{if(++calls===1)throw Error("unavailable");return report;});
 await assert.rejects(()=>retry(input));assert.deepEqual(await retry(input),report);
});
test("report validation rejects identifier leaks and invented public-facing quotations",()=>{
 assert.throws(()=>validateStageReport({...report,summary:"내부 ID 12345678-1234-1234-1234-123456789012"},input));
 assert.throws(()=>validateStageReport({...report,sections:[{title:"훅",paragraphs:[],items:[{title:"문구",body:"이유",quote:"INVENTED CLAIM"}]}]},input),/원문/);
 assert.doesNotThrow(()=>validateStageReport({...report,sections:[{title:"훅",paragraphs:[],items:[{title:"문구",body:"이유",quote:"BUILD YOUR BACK"}]}]},input));
});
