import test from "node:test";
import assert from "node:assert/strict";
import { createBlankDocument } from "@/domains/slideshow/editor/document";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import { affectedSlides } from "../review";
import { answerText } from "../answer";

test("review covers local edits and all shared-element uses without unrelated pages", () => {
  const before = createBlankDocument({structure:"sequential",aspectRatio:"4:5",slideCount:3});
  before.elements.push(makeElementDefinition({id:"title",kind:"text"}));
  for (const slide of before.slides.slice(0,2)) slide.placements.push({id:"title",elementId:"title",value:"Hello",frameOverride:null,styleOverride:null});
  const after = structuredClone(before);
  after.slides[0].placements.find(placement=>placement.id === "title")!.value = "Changed";
  assert.deepEqual(affectedSlides(before,after),["slide-1"]);
  after.elements.find(element=>element.id === "title")!.style.fontSize = 100;
  assert.deepEqual(affectedSlides(before,after),["slide-1","slide-2"]);
  after.slides.splice(1,1);
  assert.deepEqual(affectedSlides(before,after),["slide-1","slide-3"]);
});

test("incremental answers expose only the text field and safely handle JSON escapes", () => {
  assert.equal(answerText('{"kind":"answer","text":"Hello'),"Hello");
  assert.equal(answerText('{"kind":"answer","text":"Hello\\nworld","suggestion":"change"}'),"Hello\nworld");
  assert.equal(answerText('Reasoning about text'),undefined);
  assert.equal(answerText('{"kind":"answer","text":"\\u12'),undefined);
  assert.equal(answerText('{"kind":"answer","text":"\\u1234'),"\u1234");
});

test("deleting the final slide requires reviewing the new final slide", () => {
  const before = createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 3 });
  const after = structuredClone(before);
  after.slides.pop();
  assert.deepEqual(affectedSlides(before, after), ["slide-2"]);
  assert.deepEqual(affectedSlides(before, structuredClone(before)), []);
});
