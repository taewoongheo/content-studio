import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { personaSections, type Persona } from "../../domain/persona/model";
import { editPersona, readPersona, replacePersona } from "./store";
import { stagePrompt } from "../execution/prompts";

function fixture(): Omit<Persona, "revision"> {
  return { handle: "example", name: "Example", output_language: "English", analyzed_at: "2026-10-27T00:00:00Z", updated_at: "2026-10-27T00:00:00Z", analyzed_posts: 0,
    content: Object.fromEntries(personaSections.map(section => [section.id, Object.fromEntries(Object.keys(section.fields).map(key => [key, "Observed writing voice"]))])) };
}

test("one persona is replaced on reanalysis, manual edits are discarded and stale saves cannot overwrite it", () => {
  const db = openLocalDatabase(":memory:");
  try {
    assert.equal(readPersona(db), null);
    const first = replacePersona(db, fixture());
    const edited = editPersona(db, first.revision, { name: "Manual name", output_language: "English", content: { ...first.content, instructions: { instructions: "Manual instruction" } } });
    assert.equal(edited.revision, 2);
    assert.equal(readPersona(db)?.content.instructions.instructions, "Manual instruction");
    const replaced = replacePersona(db, { ...fixture(), handle: "other", content: { ...fixture().content, instructions: { instructions: "" } } });
    assert.equal(replaced.revision, 3);
    assert.equal(replaced.name, "Example");
    assert.equal(replaced.content.instructions.instructions, "");
    assert.equal((db.prepare("SELECT count(*) AS total FROM content_persona").get() as {total:number}).total, 1);
    assert.throws(() => editPersona(db, edited.revision, { name: edited.name, output_language: edited.output_language, content: edited.content }), /다른 화면/);
    assert.equal(readPersona(db)?.handle, "other");
  } finally { db.close(); }
});

test("production prompts receive the persona context appropriate to their stage without widening editing scope", () => {
  const persona = { ...fixture(), revision: 1 };
  for (const [id, fields] of Object.entries(persona.content)) {
    for (const key of Object.keys(fields)) fields[key] = `PERSONA_${id}_${key}`;
  }
  const original = structuredClone(persona);
  for (const stage of ["analysis", "production", "hook", "polish", "visual"] as const) {
    const prompt = stagePrompt("task", stage, [], persona);
    for (const [id, fields] of Object.entries(persona.content)) {
      const included = stage !== "visual" && (stage === "analysis" ? ["development", "instructions"].includes(id) : id !== "links");
      for (const key of Object.keys(fields)) {
        assert.equal(prompt.includes(`PERSONA_${id}_${key}`), included, `${stage}: ${id}.${key}`);
      }
    }
    assert.match(prompt, /Workspace guidance: liftcode.md/);
    if (stage === "visual") {
      assert.doesNotMatch(prompt, /Active text persona \(applies/);
      assert.doesNotMatch(prompt, /source_handle/);
    } else {
      assert.match(prompt, /source account's products/);
      assert.match(prompt, /Do not include reference-account or reference-material links/);
    }
  }
  assert.match(stagePrompt("task", "analysis", [], persona), /Then apply the observed development patterns/);
  assert.match(stagePrompt("task", "hook", [], persona), /revise only the hook/);
  assert.match(stagePrompt("task", "polish", [], persona), /Preserve intentional fragments, colloquial endings, humor and personality/);
  assert.deepEqual(persona, original);
  assert.doesNotMatch(stagePrompt("task", "analysis"), /Active text persona \(applies/);
});

test("legacy persona switches cannot override fixed production rules", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const legacy = { ...fixture(), preserve_structure: false, include_links: true };
    db.prepare("INSERT INTO content_persona(id, document_json, revision) VALUES(1, ?, 1)").run(JSON.stringify(legacy));
    const persona = readPersona(db)!;
    assert.equal("preserve_structure" in persona, false);
    assert.equal("include_links" in persona, false);
    const prompt = stagePrompt("task", "production", [], persona);
    assert.match(prompt, /Always apply the observed sentence and paragraph structure/);
    assert.match(prompt, /Do not include reference-account or reference-material links/);
  } finally { db.close(); }
});
