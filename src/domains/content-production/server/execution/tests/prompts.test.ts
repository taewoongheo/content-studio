import assert from "node:assert/strict";
import test from "node:test";
import Ajv from "ajv";
import { resultSchema } from "../prompts";
import { productionSteps } from "../../../domain/contracts";

test("all CLI output schemas require source parts and usage as structured fields", () => {
  const ajv = new Ajv({ strict: false });
  for (const { id: step } of productionSteps) {
    const schema = resultSchema(step);
    const validate = ajv.compile(schema);
    const output: Record<string, unknown> = Object.fromEntries(
      Object.entries(schema.properties).map(([key, field]) => [
        key, field.type === "array" ? [] : field.type === "boolean" ? true : field.type === "integer" ? 0 : "English output",
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
