import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionStore, startProduction, syncState, resetProduction } from "../runner";

test("start appends tasks while existing drafts remain and serializes shared preparation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "production-start-"));
  const previous = process.env.APIFY_API_TOKEN, previousPath = process.env.CONTENT_STUDIO_DB_PATH;
  process.env.APIFY_API_TOKEN = "fixture-key";
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const store = productionStore(), calls: string[] = [];

  try {
    store.db.prepare("INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at) VALUES('p','Post','4:5',1,'English','{}','now','now')").run();
    store.db.prepare("INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,view_count,like_count,comment_count,save_count,created_at,updated_at) VALUES('l','p','https://example.com/post','2026-10-25',100,1,1,1,'now','now')").run();
    const services = {
      execute: async () => { calls.push("execute"); },
      prepareTopics: async () => { calls.push("topics"); return {assignments:[],history:[]}; },
    };
    const ids = await startProduction(4, "http://127.0.0.1:3000", {...services, refreshSpy: async () => ({}) as never});
    assert.equal(ids.length,4);
    assert.deepEqual(calls,["topics","execute","execute","execute","execute"]);
    for (const id of ids) assert.equal(store.analysisInputs(id)[0].like_count,1);
    assert.equal(syncState().running,false);
    const states = ["running", "finished", "stopped", "failed"] as const;
    ids.forEach((id,index) => store.state(id,states[index]));
    const existing = ids.map(id => store.get(id));
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const appended = startProduction(2, "http://127.0.0.1:3000", {...services, refreshSpy: async () => { await gate; return {} as never; }});
    assert.equal(syncState().running,true);
    try {
      await assert.rejects(startProduction(1,"http://127.0.0.1:3000",services),/분석 자료를 준비/);
      assert.equal(store.list().length,4);
    } finally { release(); }
    const added = await appended;
    assert.equal(added.length,2);
    assert.equal(store.list().length,6);
    assert.deepEqual(ids.map(id => store.get(id)),existing,'starting another batch leaves existing work unchanged');
    assert.equal(syncState().running,false);
    const specified = await startProduction([
      {mode:'past_post',sourceProjectId:'p',instructions:''},
      {mode:'external_url',url:'https://www.tiktok.com/@example/photo/123',instructions:''},
    ], 'http://127.0.0.1:3000', {...services, refreshSpy:async()=>{throw new Error('Specified sources must not crawl spy accounts');}});
    assert.equal(specified.length,2);
    resetProduction();
  } finally {
    store.db.close(); rmSync(directory, { recursive: true, force: true });
    if (previous === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = previous;
    if (previousPath === undefined) delete process.env.CONTENT_STUDIO_DB_PATH; else process.env.CONTENT_STUDIO_DB_PATH = previousPath;
  }
});
