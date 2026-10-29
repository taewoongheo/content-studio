import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../persistence/store";
import { addReferenceAccount, setReferenceExcluded } from "../references/library";
import { prepareStartInput } from "./prepare";
import { stagePolicy } from "../execution/policy/stages";
import { startInputPrompt } from "../../domain/start/prompt";

function fixture() {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  addReferenceAccount(db, "example");
  db.prepare(`INSERT INTO content_external_references(id,url,account,caption,observed_at,images_json,created_at)
    VALUES('spy','https://www.tiktok.com/@example/photo/123','example','Original back routine','now','["first","second"]','now')`).run();
  return { db, store, request: { mode: "spy_reference" as const, referenceId: "spy", instructions: "" } };
}
test("spy source selection validates account and post, persists its identity and reuses full image cache", async () => {
  const { db, store, request } = fixture();
  let downloads = 0;
  const client = { posts: async () => { throw Error("must reuse stored image URLs"); } };
  const capture = async () => { downloads++; return [0, 1].map(() => ({ data: Buffer.from("webp"), width: 540, height: 675 })); };
  try {
    const [id, second] = store.create([request, request], []);
    for (const task of [id, second]) store.state(task, "running");
    assert.equal(store.get(id).input?.source?.caption, "Original back routine");
    await prepareStartInput(store, id, new AbortController().signal, client, capture);
    await prepareStartInput(store, second, new AbortController().signal, client, capture);
    await prepareStartInput(store, id, new AbortController().signal, client, capture);
    assert.equal(downloads, 1);
    const input = new ProductionStore(db).get(id).input!;
    assert.equal(input.source?.slide_count, 2);
    assert.equal(input.source?.id, "spy");
    assert.ok(input.source?.visual_set_id);
    assert.match(startInputPrompt(input, "analysis"), /NEW subject/);
    assert.match(startInputPrompt(input, "production"), /creates a blank project/);
    assert.match(startInputPrompt(input, "visual"), /visual_set_id/);
    assert.equal(stagePolicy("visual", "spy_reference").tools.has("production_read_images"), true);
    assert.equal(stagePolicy("visual", "spy_reference").tools.has("production_external_references"), false);
    assert.equal(stagePolicy("visual", "automatic").tools.has("production_read_images"), false);
    setReferenceExcluded(db, "spy", true);
    assert.throws(() => store.create([request], []), /사용할 수 없습니다/);
    setReferenceExcluded(db, "spy", false);
    db.prepare("UPDATE content_reference_accounts SET enabled=0").run();
    assert.throws(() => store.create([request], []), /사용할 수 없습니다/);
    assert.equal(store.list().length, 2);
  } finally { db.close(); }
});
test("incomplete or cancelled spy source capture cannot mark a task prepared", async () => {
  const { db, store, request } = fixture();
  const client = { posts: async () => { throw Error("unavailable"); } };
  const slide = { data: Buffer.from("webp"), width: 540, height: 675 };
  try {
    const [id] = store.create([request], []); store.state(id, "running");
    await assert.rejects(prepareStartInput(store, id, new AbortController().signal, client, async () => [slide]), /전체 슬라이드/);
    assert.equal(store.get(id).input?.source?.visual_set_id, undefined);
    const controller = new AbortController();
    await assert.rejects(prepareStartInput(store, id, controller.signal, client, async () => { controller.abort(); return [slide, slide]; }));
    assert.equal(store.get(id).input?.source?.visual_set_id, undefined);
  } finally { db.close(); }
});
