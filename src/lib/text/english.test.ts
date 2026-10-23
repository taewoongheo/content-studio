import test from "node:test";
import assert from "node:assert/strict";
import { assertEnglish } from "./english";

test("reject non-Latin and detected Latin-language prose with the exact field path", () => {
  for (const text of ["초보자를 위한 루틴", "This plan is simple. 무게는 천천히 늘린다.", "Este entrenamiento ayuda a los principiantes a elegir el peso correcto para cada ejercicio.", "Bonjour le monde"]) {
    assert.throws(() => assertEnglish({ content: { slides: [{ body: text }] } }), /ENGLISH_REQUIRED: output.content.slides\[0\].body/);
  }
});

test("English workout terms, numbers, symbols and source identifiers remain valid", () => {
  assert.doesNotThrow(() => assertEnglish({ topic: "Bench press", answer: "3 sets of 8 reps", text: "Train three times per week. Increase the weight when every set reaches 12 reps.", source: "https://example.com/논문", id: "자료-id", slides: [{ body: "Use controlled repetitions" }] }));
});
