import test from "node:test";
import assert from "node:assert/strict";
import { executeWithOutputRepair } from "./output-repair";
import { OperationError } from "@/lib/errors/operation";
import type { runCodex } from "../../process";
const input={prompt:"Create",schema:{type:"object"},origin:"server",taskId:"task",token:"secret",signal:new AbortController().signal,onActivity() {}};
const valid={review:"Checked",review_passed:true,project_id:"p",summary:{topic:"Topic",message:"Message",content_type:"Guide"},sources:[]};

test("invalid source goes back with exact field feedback; repair has no tools or run secrets",async()=>{
  const calls:Parameters<typeof runCodex>[0][]=[];
  const execute:typeof runCodex=async request=>{
    calls.push(request);
    return calls.length===1 ? {...valid,sources:[{kind:"url",id:null,url:null,part:"Unknown",used_for:"Check"}]} : valid;
  };
  assert.deepEqual(await executeWithOutputRepair(execute,input,"hook"),valid);
  assert.equal(calls.length,2);
  assert.match(calls[1].prompt,/sources/);
  assert.equal(calls[1].standalone,true);
  assert.equal(calls[1].token,"");
  assert.equal(calls[1].onThreadStarted,undefined);
  assert.deepEqual(calls[1].capabilities,{webSearch:false,shell:false,imageGeneration:false});
});
test("repair stops after two corrections and retains the failed output",async()=>{
  let calls=0;
  await assert.rejects(executeWithOutputRepair(async()=>{calls++;return {};},input,"hook"),error=>{
    assert.ok(error instanceof OperationError);assert.equal(error.code,"OUTPUT_REPAIR_EXHAUSTED");
    assert.deepEqual(error.details.output,{});return true;
  });
  assert.equal(calls,3);
});
test("service failures and cancellation never enter the output correction loop",async()=>{
  for(const error of [new OperationError("CLI_PROCESS_FAILED","offline"),new Error("database failed")]){
    let calls=0;
    await assert.rejects(executeWithOutputRepair(async()=>{calls++;throw error;},input,"hook"),e=>e===error);
    assert.equal(calls,1);
  }
  const controller=new AbortController();controller.abort();let calls=0;
  await assert.rejects(executeWithOutputRepair(async()=>{calls++;return valid;},{...input,signal:controller.signal},"hook"));
  assert.equal(calls,0);
});
test("malformed CLI JSON is fed back as raw data for correction",async()=>{
  let calls=0;
  const result=await executeWithOutputRepair(async request=>{
    if(++calls===1)throw new OperationError("CLI_OUTPUT_INVALID_JSON","bad json",{output:'{"unfinished"'});
    assert.match(request.prompt,/unfinished/);return valid;
  },input,"hook");
  assert.deepEqual(result,valid);
});

test("quality rejection is returned unchanged without attempts to turn it into approval",async()=>{
  let calls=0; const rejected={...valid,review:"Wrong movement remains",review_passed:false};
  assert.deepEqual(await executeWithOutputRepair(async()=>{calls++;return rejected;},input,"hook"),rejected);
  assert.equal(calls,1);
});
