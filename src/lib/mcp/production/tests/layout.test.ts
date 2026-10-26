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

test("production MCP queries and layout cloning stay within the original analysis pool",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"production-layout-tools-"));
 process.env.CONTENT_STUDIO_DB_PATH=join(directory,"test.sqlite");
 const store=productionStore(),source=seedLayoutSource(store.db,"assigned"),outside=seedLayoutSource(store.db,"outside");
 const [id]=store.create(1,[source]);store.state(id,"running");
 store.completeAnalysis(id,{analysis:"Observed",topic:"New topic",message:"New message",content_type:"Routine",answer:"A session",presentation:"Cards",reason:"Useful",expected_response:"Save",goal_connection:"Follow",difference_from_recent:"Different",sources:[]});store.state(id,"running");
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
  const result=await call("production_clone_project",{sourceProjectId:source.project_id,reason:"The same broad routine format fits."});
  assert.ok(!result.isError);projectId=String(result.structuredContent!.projectId);
  assert.equal(store.get(id).task.project_id,projectId);
 }finally{await client.close();await server.close();if(projectId)contentJobRegistry.remove(projectId);store.db.close();await rm(directory,{recursive:true,force:true});}
});
