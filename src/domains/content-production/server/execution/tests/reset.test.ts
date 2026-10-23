import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { productionStore, execute, resetProduction } from "../runner";
import { createTaskProject } from "../../projects";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";

test("reset removes drafts/projects/assets, cancels late output and preserves formal content/references", async () => {
  const directory = await mkdtemp(join(tmpdir(), "production-reset-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const store = productionStore();
  const direction = { analysis: "A practical plan.", topic: "arms", content_type: "routine", message: "train",
    answer: "3 sets", presentation: "cards", reason: "useful", expected_response: "save",
    goal_connection: "install", difference_from_recent: "new", sources: [] };
  try {
    const ids = store.create(3);
    const projects = ids.map(id => {
      store.state(id, "running");
      store.completeAnalysis(id, direction);
      store.state(id, "running");
      const { projectId } = createTaskProject(store, id, 1);
      store.db.prepare("INSERT INTO content_project_assets(project_id,asset_id,name,mime_type,byte_size,data) VALUES(?,'image','Image','image/png',1,?)")
        .run(projectId, Buffer.from([1]));
      return projectId;
    });
    // A published project has left the canvas and must survive reset.
    const log = store.get(ids[0]).task.log_id;
    store.db.prepare("UPDATE content_creation_logs SET project_id=?,post_url='https://example.com/post' WHERE id=?").run(projects[0], log);
    store.db.prepare("DELETE FROM content_drafts WHERE id=?").run(ids[0]);
    store.db.prepare("INSERT INTO content_external_references(id,url,account,caption,observed_at,images_json,created_at) VALUES('reference','https://www.tiktok.com/@example/photo/123','example','A routine','now','[]','now')").run();
    store.state(ids[1], "stopped");
    store.state(ids[2], "stopped");
    let finish!: (value: Record<string, unknown>) => void;
    const execution = execute(ids[2], "http://127.0.0.1:3000", () => new Promise(resolve => { finish = resolve; }));
    resetProduction();
    finish({ bad: "late output" });
    await execution;
    assert.equal(store.list().length, 0);
    for (const table of ["content_analysis_drafts", "content_production_drafts", "content_hook_drafts", "content_visual_drafts"])
      assert.equal((store.db.prepare(`SELECT count(*) n FROM ${table}`).get() as {n:number}).n, 0);
    for (const projectId of projects.slice(1)) {
      assert.equal(store.db.prepare("SELECT id FROM content_projects WHERE id=?").get(projectId), undefined);
      assert.equal(contentJobRegistry.has(projectId), false);
      assert.equal(store.db.prepare("SELECT asset_id FROM content_project_assets WHERE project_id=?").get(projectId), undefined);
    }
    assert.ok(store.db.prepare("SELECT id FROM content_projects WHERE id=?").get(projects[0]));
    assert.ok(store.db.prepare("SELECT asset_id FROM content_project_assets WHERE project_id=?").get(projects[0]));
    assert.ok(store.db.prepare("SELECT id FROM content_creation_logs WHERE id=?").get(log));
    assert.ok(store.db.prepare("SELECT id FROM content_external_references WHERE id='reference'").get());
    assert.deepEqual(store.db.pragma("foreign_key_check"), []);
    resetProduction(); // Empty canvas reset is safe.
  } finally {
    store.db.close();
    delete process.env.CONTENT_STUDIO_DB_PATH;
    await rm(directory, { recursive: true, force: true });
  }
});
