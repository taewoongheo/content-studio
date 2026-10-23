import assert from "node:assert/strict";
import test from "node:test";
import Ajv from "ajv";
import { resultSchema } from "../prompts";
import { productionSteps } from "../../../domain/contracts";
const summary = {
  title: "A simple plan", topic: "Arms", message: "A complete session", hook: "Start here",
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
  for (const step of ["production", "hook", "visual"] as const) {
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
