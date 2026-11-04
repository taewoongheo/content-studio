import assert from "node:assert/strict";
import test from "node:test";
import { createBlankDocument } from "@/domains/slideshow/editor/document";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { assertSourceStructure } from "./structure";

function source() {
  const document = createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 8 });
  document.elements.push(makeElementDefinition({ id: "copy", kind: "text" }));
  for (const slide of document.slides) slide.placements.push({
    id: "copy", elementId: "copy", value: "Original exercise", frameOverride: null, styleOverride: null,
  });
  return document;
}

test("rejects a self-consistent draft plan that inserts explanations into an eight-page source", () => {
  const original = source();
  const mutations: Array<(document: EditorDocument) => void> = [
    d => { d.slides.push({ ...structuredClone(d.slides[1]), id: "invented-explanation" }); },
    d => { d.slides.splice(2, 1); },
    d => { [d.slides[1], d.slides[2]] = [d.slides[2], d.slides[1]]; },
    d => { d.slides[1].role = "cta"; },
    d => { d.slides[1].placements.push({ ...d.slides[1].placements.at(-1)!, id: "extra-explanation" }); },
    d => { d.slides[1].placements.pop(); },
    d => { d.elements.find(e => e.id === "copy")!.kind = "image"; },
  ];
  for (const mutate of mutations) {
    const draft = structuredClone(original);
    mutate(draft);
    assert.throws(() => assertSourceStructure(original, draft), { code: "SOURCE_FORMAT_MISMATCH" });
  }
});

test("allows replacement copy, image values and readability repairs within the same source slots", () => {
  const original = source(), draft = structuredClone(original);
  draft.slides[1].placements.at(-1)!.value = "A different exercise";
  draft.slides[1].placements.at(-1)!.styleOverride = { fontSize: 40 };
  draft.slides[1].placements.at(-1)!.frameOverride = { x: 0.1, y: 0.2, width: 0.8, height: 0.3 };
  assert.doesNotThrow(() => assertSourceStructure(original, draft));
});
