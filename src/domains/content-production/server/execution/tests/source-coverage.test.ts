import { seedLayoutSource } from "../../projects/testing/fixtures";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionStore, execute, recordSourceReview, recordAnalysisRead } from "../runner";

test("indexed source reads cannot complete analysis; an unindexed full read can", async () => {
  const dir = await mkdtemp(join(tmpdir(), "source-coverage-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(dir, "test.sqlite");
  const store = productionStore();
  const direction = { analysis: "Checked", reasoning: { observations: [], interpretations: [], candidates: [] },
    topic: "Arms", content_type: "Routine", message: "Train arms", answer: "Exercises", presentation: "Cards", reason: "Useful",
    expected_response: "Save", goal_connection: "Follow", difference_from_recent: "New", sources: [] };
  try {
    const origin = seedLayoutSource(store.db);
    const unused = seedLayoutSource(store.db,"unused-layout");
    const [id] = store.create([{ mode: "external_url", url: "https://www.tiktok.com/@example/photo/123", instructions: "" }], [origin,unused]);
    store.state(id, "running");
    store.savePreparedSource(id, { id: "123", visual_set_id: "stored-source", slide_count: 2 });
    store.state(id, "stopped");
    for (const indexes of [[0], [], undefined]) {
      await execute(id, "http://127.0.0.1:3000", async () => {
        if (store.get(id).task.current_step === "production") throw Error("Stop before paid generation");
        recordSourceReview(id, undefined, "stored-source", indexes);
        recordSourceReview(id,origin.project_id);
        recordAnalysisRead(id,[origin.id]);
        return {...direction,sources:[{kind:"log",id:origin.id,clone_project_id:origin.project_id,part:"Layout",used_for:"Clone"}]};
      });
      if (indexes !== undefined) {
        assert.equal(store.get(id).task.current_step, "analysis");
        assert.equal((store.get(id).analysis.error as {code:string}).code, "START_SOURCE_NOT_REVIEWED");
      } else assert.equal(store.get(id).task.current_step, "production");
    }
  } finally { store.db.close(); await rm(dir, {recursive:true,force:true}); }
});
