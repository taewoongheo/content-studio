import assert from "node:assert/strict";
import test from "node:test";
import Ajv from "ajv";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../store";
import { stageContext } from "../../execution/policy/context";
import { resultSchema } from "../../execution/prompts";
import { displayContent } from "../../../domain/display";

const reasoning = {
  observations: [{ source: "log-one, slide 2", observation: "Two alternatives are shown with a concrete selection criterion." }],
  interpretations: [{ finding: "A visible choice may help readers apply the answer.", support: "The stronger comparison gives a criterion; the weaker case only lists options.", limits: "The posts also differ in publication age." }],
  candidates: [{ direction: "Compare two exercise options using one criterion.", viewer_value: "Choose the option that fits the available equipment.", assessment: "Selected because it makes the tradeoff actionable." }],
};
const direction = { analysis: "Choose an actionable comparison.", reasoning, topic: "Exercise choices", message: "Choose for your equipment",
  content_type: "Comparison", answer: "Two options and their selection criterion", presentation: "Show the choice, then demonstrate each option",
  reason: "The observed comparison makes the decision usable", expected_response: "Save the comparison", goal_connection: "Build trust", difference_from_recent: "A different equipment choice", sources: [] };
const slide_plan = [{ slide_id: "s1", role: "body" as const, purpose: "Make the choice actionable", copy: ["Choose for your equipment"], visual: "Show two equipment options side by side" }];
const content_review = { assessment: "The criterion is consistent, wording is supported and the image shows the actual choice.", issues: [] };

test("decisions and plans survive progress saves, resume, completion and removal of the working draft", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  try {
    const [id] = store.create(1, []);
    store.state(id, "running");
    store.save(id, "analysis", { reasoning });
    store.save(id, "analysis", { analysis: "Still comparing" });
    store.state(id, "stopped");
    const resumed = new ProductionStore(db);
    assert.deepEqual(resumed.get(id).analysis.reasoning, reasoning);
    store.state(id, "running");
    store.completeAnalysis(id, direction);
    assert.deepEqual(stageContext(store.get(id)).analysis.reasoning, reasoning);
    store.state(id, "running");
    store.save(id, "production", { slide_plan });
    assert.equal(store.get(id).production?.draft_saved_at, null, "planning alone is not actual content");
    store.save(id, "production", { content: { hook: "Choose for your equipment" } });
    assert.deepEqual(resumed.get(id).production?.slide_plan, slide_plan);
    assert.deepEqual(displayContent(resumed.get(id).production!).slide_plan, slide_plan);
    db.prepare("INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at) VALUES('planned','Planned','4:5',1,'English','{}','now','now')").run();
    db.prepare("UPDATE content_drafts SET project_id='planned' WHERE id=?").run(id);
    const result = { project_id: "planned", summary: { topic: direction.topic, message: direction.message, content_type: direction.content_type }, sources: [], slide_plan, content_review };
    const blocked = { assessment: "The central claim is unsupported.", issues: [{ location: "s1", issue: "Unsupported claim", resolution: "Cannot verify the premise", status: "blocked" as const }] };
    const before = store.get(id);
    assert.throws(() => store.completeProduction(id, { ...result, content_review: blocked }), /내용 검토/);
    assert.deepEqual(store.get(id), before, "a rejected review cannot advance or overwrite saved work");
    store.completeProduction(id, result);
    const hookContext = stageContext(resumed.get(id));
    assert.equal(hookContext.task.current_step, "hook");
    assert.deepEqual(hookContext.production?.slide_plan, slide_plan);
    assert.deepEqual(hookContext.production?.content_review, content_review);
    const logId = hookContext.task.log_id;
    db.prepare("UPDATE content_creation_logs SET project_id='planned',post_url='https://example.com/published' WHERE id=?").run(logId);
    store.remove(id);
    assert.equal((db.prepare("SELECT count(*) n FROM content_stage_documents WHERE log_id=?").get(logId) as { n: number }).n, 2);
    db.prepare("DELETE FROM content_creation_logs WHERE id=?").run(logId);
    assert.equal((db.prepare("SELECT count(*) n FROM content_stage_documents").get() as { n: number }).n, 0);
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  } finally { db.close(); }
});

test("a failed save rolls back structured planning together with draft progress", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  try {
    const [id] = store.create(1, []); store.state(id, "running");
    db.exec("CREATE TRIGGER reject_progress BEFORE UPDATE ON content_analysis_drafts BEGIN SELECT RAISE(ABORT,'save failed'); END;");
    assert.throws(() => store.save(id, "analysis", { reasoning }), /save failed/);
    assert.equal(store.get(id).analysis.reasoning, undefined);
  } finally { db.close(); }
});

test("CLI schemas accept flexible comparisons and issue-free review using the production Ajv dialect", () => {
  const ajv = new Ajv({ strict: false });
  const analysis = ajv.compile(resultSchema("analysis"));
  assert.equal(analysis(direction), true, JSON.stringify(analysis.errors));
  assert.equal(analysis({ ...direction, reasoning: { observations: [], interpretations: [], candidates: [] } }), true);
  assert.equal(analysis({ ...direction, reasoning: "A freeform replacement" }), false);
  const production = ajv.compile(resultSchema("production"));
  const result = { project_id: "planned", summary: { title: "Choose", topic: direction.topic, message: direction.message, content_type: direction.content_type, hook: "Choose", caption: "", hashtags: [], slides: [{ slide_id: "s1", role: "body", copy: ["Choose"], visual: "Two options" }], changes: [] }, sources: [], slide_plan, content_review, reviewed_slide_ids: ["s1"], reviewed_revision: 1 };
  assert.equal(production(result), true, JSON.stringify(production.errors));
  const { content_review: removed, ...withoutReview } = result;
  void removed;
  assert.equal(production(withoutReview), false, "first drafts must report a content review before handoff");
});
