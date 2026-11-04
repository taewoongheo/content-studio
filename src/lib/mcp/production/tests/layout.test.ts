import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
import type {CallToolResult} from "@modelcontextprotocol/sdk/types.js";
import {createStudioMcpServer} from "../../server";
import {productionStore} from "@/domains/content-production/server/execution/runner";
import {stagePolicy} from "@/domains/content-production/server/execution/policy/stages";
import {seedLayoutSource} from "@/domains/content-production/server/projects/testing/fixtures";
import {contentJobRegistry} from "@/domains/slideshow/workflow/service";

test("production MCP separates comparison reads, selected-source cloning and blank creation",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"production-layout-tools-"));
 process.env.CONTENT_STUDIO_DB_PATH=join(directory,"test.sqlite");
 const store=productionStore(),source=seedLayoutSource(store.db,"assigned"),outside=seedLayoutSource(store.db,"outside");
 const [id]=store.create([{mode:"past_post",sourceProjectId:source.project_id,instructions:""}],[source]);store.state(id,"running");
 store.completeAnalysis(id,{analysis: "Observed", reasoning: { observations: [], interpretations: [], candidates: [] },topic:"New topic",message:"New message",content_type:"Routine",answer:"A session",presentation:"Cards",reason:"Useful",expected_response:"Save",goal_connection:"Follow",difference_from_recent:"Different",sources:[]});store.state(id,"running");
 const server=createStudioMcpServer("http://127.0.0.1:3000",{allowed:stagePolicy("production").tools,before(){}},id);
 const client=new Client({name:"layout-test",version:"1"});const [a,b]=InMemoryTransport.createLinkedPair();
 let projectId:string|undefined;
 const call=async(name:string,args:Record<string,unknown>)=>await client.callTool({name,arguments:args}) as CallToolResult;
 try{
  await server.connect(b);await client.connect(a);
  const tools=(await client.listTools()).tools.map(tool=>tool.name);
  assert.ok(tools.includes("production_clone_project"));assert.ok(!tools.includes("production_create_project"));assert.ok(!tools.includes("clone_project"));
  const pool=await call("production_query",{kind:"logs"});
  assert.deepEqual((pool.structuredContent!.items as Array<{id:string}>).map(row=>row.id),[source.id]);
  assert.equal((await call("production_query",{kind:"logs",ids:[outside.id]})).isError,true);
  assert.equal((await call("production_clone_project",{sourceProjectId:outside.project_id,reason:"Outside pool"})).isError,true);
  assert.equal((await call("production_create_project",{slideCount:6})).isError,true);
  const result=await call("production_clone_project",{sourceProjectId:source.project_id,reason:"The same broad routine format fits."});
  assert.ok(!result.isError);projectId=String(result.structuredContent!.projectId);
  assert.equal(store.get(id).task.project_id,projectId);
  const [externalId]=store.create([{mode:"external_url",url:"https://www.tiktok.com/@example/photo/123",instructions:""}],[]);
  store.state(externalId,"running");
  store.completeAnalysis(externalId,{analysis:"Checked source",reasoning:{observations:[],interpretations:[],candidates:[]},topic:"External topic",message:"External message",content_type:"Comparison",answer:"The answer",presentation:"Source table",reason:"Useful",expected_response:"Save",goal_connection:"Follow",difference_from_recent:"Explicit source",sources:[]});
  store.state(externalId,"running");
  const externalServer=createStudioMcpServer("http://127.0.0.1:3000",{allowed:stagePolicy("production","external_url").tools,before(){}},externalId);
  const externalClient=new Client({name:"external-test",version:"1"});const [c,d]=InMemoryTransport.createLinkedPair();
  let blankId:string|undefined;
  try {
    await externalServer.connect(d);await externalClient.connect(c);
    const externalTools=(await externalClient.listTools()).tools.map(tool=>tool.name);
    assert.ok(externalTools.includes("production_create_project"));
    assert.ok(!externalTools.includes("production_clone_project"));
    assert.ok(!externalTools.includes("production_repair_badge"));
    const blank=await externalClient.callTool({name:"production_create_project",arguments:{slideCount:4}}) as CallToolResult;
    assert.ok(!blank.isError);blankId=String(blank.structuredContent!.projectId);
    assert.equal(store.get(externalId).task.project_id,blankId);
    assert.equal(contentJobRegistry.get(blankId).editor.document.slides.length,4);
    const repeated=await externalClient.callTool({name:"production_create_project",arguments:{slideCount:2}}) as CallToolResult;
    assert.equal(repeated.structuredContent!.projectId,blankId);
    assert.equal(repeated.structuredContent!.reused,true);
  } finally {await externalClient.close();await externalServer.close();if(blankId)contentJobRegistry.remove(blankId);}

 }finally{await client.close();await server.close();if(projectId)contentJobRegistry.remove(projectId);store.db.close();await rm(directory,{recursive:true,force:true});}
});
