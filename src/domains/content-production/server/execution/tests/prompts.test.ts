import assert from "node:assert/strict";
import test from "node:test";
import Ajv from "ajv";
import { resultSchema, stagePrompt } from "../prompts";
import { productionSteps } from "../../../domain/contracts";
const summary = {
  title: "A simple plan", topic: "Arms", message: "A complete session", content_type: "Routine cards", hook: "Start here",
  caption: "", hashtags: [], slides: [{ slide_id: "slide-1", role: "hook", copy: ["Start here"], visual: "A large lifter image" }], changes: [],
};
const planning = {
  slide_plan: [{ slide_id: "slide-1", role: "hook", purpose: "Present the promise", copy: ["Start here"], visual: "Show the starting exercise" }],
  content_review: { assessment: "The promise matches the actual content.", issues: [] },
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
    if (step === "analysis") output.reasoning = { observations: [], interpretations: [], candidates: [] };
    if (step === "production") Object.assign(output, planning);
    const source = { kind: "url", id: null, url: "https://example.com", part: "Research summary", used_for: "Checked the prescription.", visual_set_id: null, clone_project_id: null };
    assert.ok(validate({ ...output, sources: [source] }), JSON.stringify(validate.errors));
    assert.ok(validate({ ...output, sources: [{...source,clone_project_id:"selected-internal"}] }), JSON.stringify(validate.errors));
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
      project_id: "project", summary, sources: [], ...(step === "visual" ? {reviewed_slide_ids: ["slide-1"], reviewed_revision: 9} : {}),
      ...(step !== "production" ? { review: "Ready for the next step.", review_passed: true } : planning),
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
    assert.match(prompt,/Analysis owns source selection/);
    assert.ok(prompt.includes(`"external_collection":${false}`));
    assert.ok(prompt.includes(`"external_post_limit":${0}`));
    assert.ok(prompt.includes(`"web_search":"${id === "production" ? "live" : "disabled"}"`));
  }
  for (const step of ["production","hook","visual","polish"] as const) {
    const validate = new Ajv({strict:false}).compile(resultSchema(step));
    const output = {project_id:"p",summary,sources:[],...(step === "visual" ? {reviewed_slide_ids:["s"],reviewed_revision:0} : {}),
      ...(step === "production" ? planning : {review:"Checked",review_passed:true})};
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
  assert.match(past, /Preserve the confirmed internal origin/);
  assert.match(past, /Use chest exercises/);
  const external = stagePrompt("external", "analysis", [], null, null, {
    request: { mode: "external_url", url: "https:\/\/www.tiktok.com\/@example\/photo\/123", instructions: "" },
    source: { id: "123", caption: "SOURCE CAPTION", visual_set_id: "source-slides" },
  });
  assert.match(external, /Keep its topic/);
  assert.match(external, /SOURCE CAPTION/);
  assert.match(past, /Do not apply duplicate prevention/);
  assert.match(external, /Do not apply duplicate prevention/);
  assert.match(stagePrompt("auto", "analysis"), /duplicate is accepted/);
});

test("later stages do not receive source-selection tasks or external captions",()=>{
  for(const mode of ["external_url","spy_reference"] as const){
    const request=mode === "external_url" ? {mode,url:"https://www.tiktok.com/@example/photo/123",instructions:""} : {mode,referenceId:"ref",instructions:""};
    const input={request,source:{id:"source",caption:"PRIVATE SOURCE CAPTION",visual_set_id:"private-set"}};
    for(const step of ["production","hook","polish","visual"] as const){
      const prompt=stagePrompt("task",step,[],null,null,input);
      assert.ok(!prompt.includes("PRIVATE SOURCE CAPTION"));
      assert.ok(!prompt.includes("Read the selected external caption and ALL preserved slides"));
      assert.ok(!prompt.includes("they are not mandatory layout clones"));
    }
  }
});

test("only visual output requires image review evidence",()=>{
  for(const step of ["production","hook","polish","visual"] as const){
    const fields=resultSchema(step).properties;
    assert.equal("reviewed_slide_ids" in fields,step === "visual");
    assert.equal("reviewed_revision" in fields,step === "visual");
  }
});
