import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { POST } from "./route";
import { productionStore, execute } from "@/domains/content-production/server/execution/runner";

test("visual task route hides reference context, blocks all source tools and preserves schema diagnostics", async () => {
  const directory=await mkdtemp(join(tmpdir(),"production-diagnostics-route-"));
  process.env.CONTENT_STUDIO_DB_PATH=join(directory,"test.sqlite");
  const store=productionStore();
  try {
    const [id]=store.create(1);
    store.db.prepare("INSERT INTO content_visual_drafts(draft_id,created_at,updated_at) VALUES(?,'now','now')").run(id);
    store.db.prepare("UPDATE content_drafts SET current_step='visual' WHERE id=?").run(id);
    store.db.prepare("UPDATE content_analysis_drafts SET analysis=? WHERE draft_id=?").run("private-layout-source",id);
    let requestId=0;
    await execute(id,"http://127.0.0.1:3000",async input=>{
      const call=async(name:string,args:Record<string,unknown>)=>{
        const response=await POST(new Request(`http://127.0.0.1:3000/api/content-production/agent/${id}`,{
          method:"POST",headers:{host:"127.0.0.1:3000",authorization:`Bearer ${input.token}`,"Content-Type":"application/json",Accept:"application/json, text/event-stream"},
          body:JSON.stringify({jsonrpc:"2.0",id:++requestId,method:"tools/call",params:{name,arguments:args}}),
        }),{params:Promise.resolve({taskId:id})});
        assert.equal(response.status,200);
        return (await response.json()).result;
      };
      assert.equal((await call("production_external_references",{})).structuredContent.error.code,"TOOL_NOT_FOUND");
      assert.equal((await call("production_visual_references",{keywords:"wrong"})).structuredContent.error.code,"TOOL_NOT_FOUND");
      assert.equal((await call("production_save_draft",{patch:"wrong"})).structuredContent.error.code,"INVALID_INPUT");
      assert.equal((await call("production_preview_project",{projectId:"unselected"})).structuredContent.error.code,"TOOL_NOT_FOUND");
      const context = await call("production_context",{});
      assert.ok(!JSON.stringify(context).includes("private-layout-source"));
      return {}; // Deliberate final-output mismatch, distinct from the tool errors above.
    });
    const error=store.get(id).visual?.error as {code:string;phase:string;tool_calls:Array<{tool:string;code?:string;input:unknown}>};
    assert.equal(error.code,"OUTPUT_SCHEMA_INVALID");assert.equal(error.phase,"output");
    assert.equal(error.tool_calls.length,5);
    assert.ok(error.tool_calls.some(call=>call.code==="INVALID_INPUT"));
    assert.ok(error.tool_calls.some(call=>call.code==="TOOL_NOT_FOUND"));
    assert.equal(store.get(id).task.state,"failed");
  } finally { store.db.close();await rm(directory,{recursive:true,force:true}); }
});
