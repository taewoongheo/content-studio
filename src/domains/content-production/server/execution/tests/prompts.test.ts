import assert from "node:assert/strict";
import test from "node:test";
import Ajv from "ajv";
import { resultSchema, stagePrompt } from "../prompts";
import { productionSteps } from "../../../domain/contracts";
const summary = {
  title: "A simple plan", topic: "Arms", message: "A complete session", content_type: "Routine cards", hook: "Start here",
  caption: "", hashtags: [], slides: [{ slide_id: "slide-1", role: "hook", copy: ["Start here"], visual: "A large lifter image" }], changes: [],
};

test("all CLI output schemas require source parts and usage as structured fields", () => {
  const ajv = new Ajv({ strict: false });
  for (const { id: step } of productionSteps) {
    const schema = resultSchema(step);
    const validate = ajv.compile(schema);
    const output: Record<string, unknown> = Object.fromEntries(
      Object.entries(schema.properties).map(([key, field]) => [
        key, key === "summary" ? summary : field.type === "array" ? [] : field.type === "boolean" ? true : field.type === "integer" ? 0 : "English output",
      ]),
    );
    const source = { kind: "url", id: null, url: "https://example.com", part: "Research summary", used_for: "Checked the prescription.", visual_set_id: null };
    assert.ok(validate({ ...output, sources: [source] }), JSON.stringify(validate.errors));
    const { part, ...withoutPart } = source;
    void part;
    assert.equal(validate({ ...output, sources: [withoutPart] }), false);
    assert.equal(validate({ ...output, sources: JSON.stringify([source]) }), false);
    assert.equal(validate({ ...output, sources: [{ ...source, used_for: null }] }), false);
  }
});


test("content-stage summaries must be objects, not prose or encoded JSON strings", () => {
  const ajv = new Ajv({ strict: false });
  for (const step of ["production", "hook", "visual", "polish"] as const) {
    const schema = resultSchema(step);
    const validate = ajv.compile(schema);
    const output = {
      project_id: "project", summary, sources: [], reviewed_slide_ids: ["slide-1"], reviewed_revision: 9,
      ...(step !== "production" ? { review: "Ready for the next step.", review_passed: true } : {}),
    };
    assert.ok(validate(output), JSON.stringify(validate.errors));
    assert.equal(validate({ ...output, summary: "First draft is complete." }), false);
    assert.equal(validate({ ...output, summary: JSON.stringify(summary) }), false);
    assert.equal(validate({ ...output, summary: { ...summary, slides: "All six slides" } }), false);
  }
});


test("every stage shares metadata meanings; no stage may discover external posts", () => {
  for (const {id} of productionSteps) {
    const prompt = stagePrompt("metadata-check",id);
    assert.match(prompt,/docs\/content-metadata\.md/);
    assert.match(prompt,/Analyze EVERY post/);
    assert.ok(prompt.includes(`"external_collection":${false}`));
    assert.ok(prompt.includes(`"external_post_limit":${id === "visual" || id === "polish" ? 0 : id === "analysis" ? 10 : 5}`));
    assert.ok(prompt.includes(`"web_search":"${id === "production" || id === "hook" ? "live" : "disabled"}"`));
  }
  for (const step of ["production","hook","visual","polish"] as const) {
    const validate = new Ajv({strict:false}).compile(resultSchema(step));
    const output = {project_id:"p",summary,sources:[],reviewed_slide_ids:["s"],reviewed_revision:0,
      ...(step === "production" ? {} : {review:"Checked",review_passed:true})};
    const {content_type: _format,...incomplete} = summary;
    void _format;
    assert.equal(validate({...output,summary:incomplete}),false);
  }
});

test("start modes preserve the right subject or format and permit accepted duplicates", () => {
  const past = stagePrompt("past", "production", [], null, null, {
    request: { mode: "past_post", sourceProjectId: "selected-source", instructions: "Use chest exercises" },
    source: { id: "source-log", project_id: "selected-source" },
  });
  assert.match(past, /clones ONLY this selected source/);
  assert.match(past, /Use chest exercises/);
  const external = stagePrompt("external", "analysis", [], null, null, {
    request: { mode: "external_url", url: "https:\/\/www.tiktok.com\/@example\/photo\/123", instructions: "" },
    source: { id: "123", caption: "SOURCE CAPTION", visual_set_id: "source-slides" },
  });
  assert.match(external, /Keep the external post's SUBJECT/);
  assert.match(external, /SOURCE CAPTION/);
  for (const prompt of [past, external, stagePrompt("auto", "production")]) {
    assert.match(prompt, /ALL considered alternatives overlap/);
    assert.match(prompt, /accepted duplicate/);
  }
});
