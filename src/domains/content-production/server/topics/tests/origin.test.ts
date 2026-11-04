import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../../persistence/store";
import { seedLayoutSource } from "../../projects/testing/fixtures";
import { prepareStartInput } from "../../start/prepare";
import { withReferenceImages } from "../../start/media/attachments";
import { stagePolicy } from "../../execution/policy/stages";
import { startInputPrompt } from "../../../domain/start/prompt";
import { isExternalProduction } from "../../../domain/start/input";
import { assertSourcePageCount } from "../../projects/format/snapshot";
import type { TopicAssignment } from "../../../domain/topics/model";

const assignment = (direct: string[], related: string[] = []): TopicAssignment => ({
  candidate: { id: "topic", topic: "Bodyweight workout", reader_question: "What can I do without weights?",
    content_type: "Exercise cards", message: "A bodyweight session", rationale: "Observed source", reference_ids: ["spy"] },
  requested_lane: direct.length ? "proven" : "exploration", selected_lane: direct.length ? "proven" : "exploration",
  status: direct.length ? "proven" : "untried", direct_log_ids: direct, related_log_ids: related, evidence: "Matched topic", fallback: null,
});
function fixture() {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  db.prepare("INSERT INTO content_reference_accounts(username,url,created_at) VALUES('example','https://www.tiktok.com/@example','now')").run();
  db.prepare(`INSERT INTO content_external_references(id,url,account,caption,observed_at,images_json,created_at)
    VALUES('spy','https://www.tiktok.com/@example/photo/123','example','Bodyweight workout','now','["expired"]','now')`).run();
  return { db, store };
}

test("automatic origins use only topic matches; related and unrelated posts cannot become clone origins", () => {
  const { db, store } = fixture();
  try {
    const direct = seedLayoutSource(db, "direct"), related = seedLayoutSource(db, "related"), unrelated = seedLayoutSource(db, "unrelated");
    const assignments = [assignment([direct.id], [related.id]), assignment([], [related.id])];
    const [internal, external] = store.create(2, [unrelated], { assignments, history: [direct, related, unrelated] });
    assert.deepEqual(store.analysisInputs(internal).map(row => [row.id, row.selection_group]), [[direct.id, "direct"], [related.id, "related"]]);
    assert.deepEqual(store.analysisInputs(external).map(row => row.id), [related.id]);
    assert.equal(store.cloneSourceAllowed(internal, direct.project_id), true);
    assert.equal(store.cloneSourceAllowed(internal, related.project_id), false);
    assert.equal(store.cloneSourceAllowed(internal, unrelated.project_id), false);
    assert.equal(store.sourceProjectAllowed(internal, related.project_id), true, "related evidence remains readable");
    assert.equal(store.cloneSourceAllowed(external, related.project_id), false);
    assert.equal(store.get(internal).input?.origin, "internal");
    const input = new ProductionStore(db).get(external).input!;
    assert.equal(input.request.mode, "automatic", "automatic overlap policy must survive source resolution");
    assert.equal(input.origin, "spy"); assert.equal(input.source?.id, "spy");
    assert.equal(isExternalProduction(input), true);
    const [empty] = store.create(1);
    assert.deepEqual(store.analysisInputs(empty), [], "no implicit recent/performance fallback");
  } finally { db.close(); }
});

test("automatic spy capture refreshes expired URLs once and later tasks/nodes only reuse stored slides", async () => {
  const { db, store } = fixture();
  let apifyCalls = 0, downloads = 0;
  const client = { posts: async () => { apifyCalls++; return [{ images: ["fresh-1", "fresh-2"] }] as never; } };
  const capture = async (urls: string[]) => {
    downloads++;
    if (urls[0] === "expired") throw Error("Expired image URL");
    return urls.map(url => ({ data: Buffer.from(url), width: 540, height: 675 }));
  };
  const signal = new AbortController().signal;
  try {
    const ids = store.create(2, [], { assignments: [assignment([]), assignment([])], history: [] });
    for (const id of ids) {
      store.state(id, "running");
      await prepareStartInput(store, id, signal, client, capture);
      await prepareStartInput(new ProductionStore(db), id, signal, client, capture);
      const input = store.get(id).input!;
      assert.equal(input.source?.slide_count, 2);
      assert.match(startInputPrompt(input, "analysis"), /no direct own-post history/);
      assert.match(startInputPrompt(input, "production"), /Use production_create_project/);
      assert.throws(() => assertSourcePageCount(input, 3), { code: "SOURCE_FORMAT_MISMATCH" });
      assert.doesNotThrow(() => assertSourcePageCount(input, 2));
      for (const step of ["analysis", "production", "hook", "polish", "visual"] as const) {
        const policy = stagePolicy(step, input);
        assert.equal(policy.tools.has("production_create_project"), true);
        assert.equal(policy.tools.has("production_clone_project"), false);
        assert.equal(policy.tools.has("production_repair_badge"), false);
        assert.equal(policy.tools.has("production_reference_images"), false, "later nodes cannot trigger Apify recollection");
        assert.equal(policy.tools.has("production_external_references"), false);
        assert.equal(policy.tools.has("production_read_images"), true);
        assert.equal(policy.tools.has("production_comparisons"), true);
        await withReferenceImages(store, input, step, signal, async paths => {
          assert.equal(paths.length, ["production", "visual"].includes(step) ? 2 : 0);
          for (const [index, path] of paths.entries()) assert.equal(await readFile(path, "utf8"), `fresh-${index + 1}`);
        });
      }
    }
    assert.equal(apifyCalls, 1); assert.equal(downloads, 2);
  } finally { db.close(); }
});


test("automatic spy topic can change while its source format and image cache remain fixed", async () => {
  const { db, store } = fixture();
  const direction = { analysis: "New subject in observed cards", reasoning: { observations: [], interpretations: [], candidates: [] },
    topic: "Bodyweight legs", content_type: "Exercise cards", message: "Train legs", answer: "Two movements", presentation: "Two source roles",
    reason: "New subject", expected_response: "Save", goal_connection: "Follow", difference_from_recent: "Different subject", sources: [] };
  try {
    const [id] = store.create(1, [], { assignments: [assignment([])], history: [] });
    store.state(id, "running");
    await prepareStartInput(store, id, new AbortController().signal,
      { posts: async () => { throw Error("No Apify needed for available images"); } },
      async () => [{ data: Buffer.from("one"), width: 540, height: 675 }]);
    const source = store.get(id).input!.source;
    store.completeAnalysis(id, direction); store.state(id, "running");
    const { analysis, reasoning, sources, ...change } = direction;
    void analysis; void reasoning; void sources;
    assert.doesNotThrow(() => store.changeDirection(id, { ...change, topic: "Bodyweight shoulders" }, "collision"));
    assert.equal(store.get(id).analysis.topic, "Bodyweight shoulders");
    assert.deepEqual(store.get(id).input!.source, source);
    assert.throws(() => store.changeDirection(id, { ...change, content_type: "Explanation" }, "collision"), /포맷/);
    assert.throws(() => assertSourcePageCount(store.get(id).input!, 2), { code: "SOURCE_FORMAT_MISMATCH" });
  } finally { db.close(); }
});
