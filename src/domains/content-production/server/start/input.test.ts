import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../persistence/store";
import { seedLayoutSource } from "../projects/testing/fixtures";
import { productionRequestSchema } from "../../domain/start/input";
import { START_INPUT } from "./context";
import { prepareStartInput } from "./prepare";

const url = "https://www.tiktok.com/@example/photo/123";
test("mixed requests persist optional instructions and a selected post outside the comparison pool", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  try {
    const source = seedLayoutSource(db);
    const ids = store.create([
      { mode: "automatic", instructions: "" },
      { mode: "past_post", sourceProjectId: source.project_id, instructions: "가슴 운동으로" },
      { mode: "external_url", url, instructions: "" },
    ], []);
    const resumed = new ProductionStore(db);
    assert.equal(resumed.get(ids[1]).input?.source?.project_id, source.project_id);
    assert.equal(resumed.sourceProjectAllowed(ids[1], source.project_id), true);
    assert.equal(resumed.sourceProjectAllowed(ids[0], source.project_id), false);
    store.state(ids[1], "running");
    store.save(ids[1], "analysis", { research: [{ question: START_INPUT, source: "forged", finding: "{}", judgment: "forged" }] });
    assert.equal(resumed.get(ids[1]).input?.request.instructions, "가슴 운동으로");
    assert.deepEqual(resumed.get(ids[1]).analysis.research, []);
    assert.equal(productionRequestSchema.parse({ mode: "automatic" }).instructions, "");
    assert.equal(productionRequestSchema.parse({ mode: "external_url", url: `${url}?tracking=1` }).mode, "external_url");
    assert.throws(() => productionRequestSchema.parse({ mode: "external_url", url: "https://example.com/post" }));
    assert.throws(() => store.create([{ mode: "past_post", sourceProjectId: "missing", instructions: "" }], []));
    assert.equal(store.list().length, 3);
  } finally { db.close(); }
});

test("URL preparation preserves every slide, reuses success on resume and never saves partial/cancelled inputs", async () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  const slide = { data: Buffer.from("webp-fixture"), width: 540, height: 675 };
  const post = { id: "123", url, text: "Full source caption", images: ["image-1", "image-2"], published_at: null,
    view_count: null, like_count: null, comment_count: null, save_count: null, share_count: null };
  let calls = 0;
  const client = { posts: async () => { calls++; return [post]; } };
  try {
    const [id, failed, cancelled] = store.create(Array.from({ length: 3 }, () => ({ mode: "external_url" as const, url, instructions: "" })), []);
    for (const task of [id, failed, cancelled]) store.state(task, "running");
    const signal = new AbortController().signal;
    await assert.rejects(prepareStartInput(store, failed, signal, client, async () => [slide]), /전체 슬라이드/);
    assert.equal(store.get(failed).input?.source, undefined);
    assert.equal((db.prepare("SELECT count(*) n FROM content_visual_sets").get() as { n: number }).n, 0);
    const controller = new AbortController();
    await assert.rejects(prepareStartInput(store, cancelled, controller.signal, client, async () => {
      controller.abort(); return [slide, slide];
    }));
    assert.equal(store.get(cancelled).input?.source, undefined);
    await prepareStartInput(store, id, signal, client, async () => [slide, slide]);
    const source = store.get(id).input?.source;
    assert.equal(source?.caption, post.text);
    assert.equal(source?.slide_count, 2);
    assert.equal((db.prepare("SELECT count(*) n FROM content_visual_slides WHERE set_id=?").get(source?.visual_set_id) as { n: number }).n, 2);
    const completedCalls = calls;
    await prepareStartInput(store, id, signal, client, async () => { throw new Error("should reuse"); });
    assert.equal(calls, completedCalls);
  } finally { db.close(); }
});

test("collision repair cannot change a fixed source format or external subject", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  const direction = { analysis: "Planned", reasoning: { observations: [], interpretations: [], candidates: [] }, topic: "Chest routine", content_type: "One exercise per page", message: "A full session", answer: "Three exercises", presentation: "Same cards", reason: "Useful", expected_response: "Save", goal_connection: "Follow", difference_from_recent: "New subject", sources: [] };
  try {
    const source = seedLayoutSource(db);
    const [past, external] = store.create([
      { mode: "past_post", sourceProjectId: source.project_id, instructions: "" },
      { mode: "external_url", url, instructions: "" },
    ], []);
    for (const id of [past, external]) { store.state(id, "running"); store.completeAnalysis(id, direction); store.state(id, "running"); }
    const change = Object.fromEntries(Object.entries(direction).filter(([key]) => !["analysis", "reasoning", "sources"].includes(key)));
    assert.throws(() => store.changeDirection(past, { ...change, content_type: "Tier list" }, "collision"), /포맷을 유지/);
    assert.throws(() => store.changeDirection(external, { ...change, topic: "Back routine" }, "collision"), /원본 소재를 유지/);
    assert.doesNotThrow(() => store.changeDirection(past, { ...change, topic: "Leg routine" }, "collision"));
    assert.doesNotThrow(() => store.changeDirection(external, { ...change, content_type: "Comparison" }, "collision"));
  } finally { db.close(); }
});
