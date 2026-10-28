import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,writeFileSync,readFileSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionStore } from "../../../execution/runner";
import { reportSourceKey } from "../../../../domain/report/model";

test("report API creates a cached editorial report without writing any production record",async()=>{
 const directory=mkdtempSync(join(tmpdir(),"stage-report-api-"));
 process.env.CONTENT_STUDIO_DB_PATH=join(directory,"test.sqlite");process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR=directory;
 const executable=join(directory,"codex.cjs"),calls=join(directory,"calls.json");process.env.CONTENT_STUDIO_CODEX_BIN=executable;
 const report={headline:"운동 비교 형식으로 새 주제 선정",summary:"비교 사례를 바탕으로 가슴 운동을 설명할 방향을 정했습니다.",sections:[{title:"선택 이유",paragraphs:["독자가 운동 차이를 쉽게 판단할 수 있도록 구성합니다."],items:[]}],next_actions:[]};
 writeFileSync(executable,`#!/usr/bin/env node
const fs=require("node:fs"),args=process.argv.slice(2);
if(args[0]==="mcp")console.log("[]");else{let prompt="";process.stdin.on("data",chunk=>prompt+=chunk);process.stdin.on("end",()=>{
const calls=fs.existsSync(${JSON.stringify(calls)})?JSON.parse(fs.readFileSync(${JSON.stringify(calls)},"utf8")):[];calls.push(prompt);fs.writeFileSync(${JSON.stringify(calls)},JSON.stringify(calls));
if(args[args.indexOf("--model")+1]!=="gpt-6-luna")process.exit(2);
fs.writeFileSync(args[args.indexOf("--output-last-message")+1],JSON.stringify(${JSON.stringify(report)}));});}
`,{mode:0o700});
 const store=productionStore();
 try {
  const {POST}=await import("@/app/api/content-production/route");
  const [id]=store.create(1);store.state(id,"running");
  store.save(id,"analysis",{analysis:"Compare exercise selection benefits.",topic:"Chest exercises",research:[{question:"What works?",source:"https://example.com/internal",finding:"Practical comparisons help",judgment:"Use the comparison format"}]});
  const before=store.get(id),sourceKey=reportSourceKey(before,"analysis");
  const post=(sourceKey:string)=>POST(new Request("http://127.0.0.1:3000/api/content-production",{method:"POST",headers:{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000","Content-Type":"application/json"},body:JSON.stringify({action:"stage_report",id,step:"analysis",sourceKey})}));
  const response=await post(sourceKey);const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.deepEqual(body.report,report);
  assert.equal((await post(sourceKey)).status,200);
  assert.equal(JSON.parse(readFileSync(calls,"utf8")).length,1);
  const prompt=JSON.parse(readFileSync(calls,"utf8"))[0];assert.match(prompt,/not literal translation/);assert.doesNotMatch(prompt,/https:\/\/example.com\/internal/);
  assert.deepEqual(store.get(id),before);
  assert.ok(readFileSync(join(directory,"stage-reports.json"),"utf8").includes(report.headline));
  assert.equal((await post("stale-key")).status,409);
 }finally{store.db.close();rmSync(directory,{recursive:true,force:true});}
});
