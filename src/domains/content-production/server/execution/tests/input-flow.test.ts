import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionStore, execute, recordAnalysisRead, recordExternalComparison } from "../runner";
import type { runCodex } from "../process";

const direction={analysis:"Compare observed post performance.",reasoning:{observations:[{source:"assigned-log",observation:"The comparison makes exercise choices visible."}],interpretations:[],candidates:[]},topic:"Arms",content_type:"Comparison",message:"Choose an exercise",answer:"Compare available options",presentation:"Comparison cards",reason:"Observed interest",expected_response:"Save",goal_connection:"Relevant audience",difference_from_recent:"Another choice",sources:[]};
test("analysis cannot finish without all assigned reads; input IDs and disabled capabilities reach the CLI", async()=>{
  const dir=await mkdtemp(join(tmpdir(),"analysis-input-flow-"));
  process.env.CONTENT_STUDIO_DB_PATH=join(dir,"test.sqlite");
  const store=productionStore();
  try {
    store.db.prepare("INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at) VALUES('p','Unique private post label','4:5',1,'English','{}','now','now')").run();
    store.db.prepare("INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,view_count,like_count,comment_count,save_count,created_at,updated_at) VALUES('assigned-log','p','https://example.com/post','2026-10-25',100,1,1,1,'now','now')").run();
    const [id]=store.create(1);
    const missing:typeof runCodex=async input=>{
      assert.equal(input.capabilities?.webSearch,false);
      assert.equal(input.capabilities?.shell,false);
      assert.match(input.prompt,/assigned-log/);
      assert.ok(!input.prompt.includes("Unique private post label"),"initial prompt carries IDs, not full post content");
      recordExternalComparison(id);
      return direction;
    };
    await execute(id,"http://127.0.0.1:3000",missing);
    assert.equal((store.get(id).analysis.error as {code:string}).code,"ANALYSIS_INPUTS_NOT_READ");
    assert.equal(store.get(id).task.current_step,"analysis");
    const complete:typeof runCodex=async input=>{
      if(store.get(id).task.current_step === "production") {
        assert.equal(input.capabilities?.webSearch,true);
        assert.deepEqual(store.get(id).analysis.reasoning, direction.reasoning);
        throw new Error("Stop before actual content generation");
      }
      const rows=store.analysisLogs(id,["assigned-log"]);
      recordAnalysisRead(id,rows.map(row=>String(row.id)));
      recordExternalComparison(id);
      return direction;
    };
    await execute(id,"http://127.0.0.1:3000",complete);
    assert.equal(store.get(id).analysis.state,"completed");
    assert.equal(store.get(id).task.current_step,"production");
  } finally {store.db.close();await rm(dir,{recursive:true,force:true});}
});
