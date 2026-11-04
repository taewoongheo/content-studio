import { saveVisuals } from "../../publication/visuals";
import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionStore, execute, recordSourceReview } from "../runner";

test("indexed source reads cannot complete analysis; an unindexed full read can", async () => {
  const dir = await mkdtemp(join(tmpdir(), "source-coverage-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(dir, "test.sqlite");
  const store = productionStore();
  const direction = { analysis: "Checked", reasoning: { observations: [], interpretations: [], candidates: [] },
    topic: "Arms", content_type: "Routine", message: "Train arms", answer: "Exercises", presentation: "Cards", reason: "Useful",
    expected_response: "Save", goal_connection: "Follow", difference_from_recent: "New", sources: [] };
  try {
    const url = "https://www.tiktok.com/@example/photo/123";
    const setId = saveVisuals(store.db, { kind:"reference",url,slides:[0,1].map(index=>({data:Buffer.from(`image-${index}`),width:540,height:675})) });
    let attached: string[] = [];
    const [id] = store.create([{ mode: "external_url", url: "https://www.tiktok.com/@example/photo/123", instructions: "" }], []);
    store.state(id, "running");
    store.savePreparedSource(id, { id: "123", visual_set_id: setId, slide_count: 2 });
    store.state(id, "stopped");
    for (const indexes of [[0], [], undefined]) {
      await execute(id, "http://127.0.0.1:3000", async input => {
        if (store.get(id).task.current_step === "production") {
          attached = input.images!.slice(2);
          assert.equal(attached.length,2);
          assert.equal(await readFile(attached[0],"utf8"),"image-0");
          assert.equal(await readFile(attached[1],"utf8"),"image-1");
          assert.match(input.prompt,/Use production_create_project/);
          throw Error("Stop before paid generation");
        }
        recordSourceReview(id, undefined, setId, indexes);
        return {...direction,sources:[{kind:"url",url,visual_set_id:setId,part:"Body structure",used_for:"Adapt composition"}]};
      });
      if (indexes !== undefined) {
        assert.equal(store.get(id).task.current_step, "analysis");
        assert.equal((store.get(id).analysis.error as {code:string}).code, "START_SOURCE_NOT_REVIEWED");
      } else assert.equal(store.get(id).task.current_step, "production");
    }
    assert.equal(attached.length,2);
    for (const path of attached) await assert.rejects(access(path));
  } finally { store.db.close(); await rm(dir, {recursive:true,force:true}); }
});
