import assert from "node:assert/strict";
import test from "node:test";
import { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import { assertCompleteProjectReview, assertSavedProjectContent, assertCurrentSlidePlan } from "./validation";

function project() {
  const registry = new ContentJobRegistry();
  const job = registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 2, outputLanguage: "English" });
  const record = registry.getRecord(job.id);
  record.savedRevision = record.editor.revision;
  record.editor.document.elements.push(makeElementDefinition({ id: "copy", kind: "text" }));
  for (const slide of record.editor.document.slides) slide.placements.push({
    id: "copy", elementId: "copy", value: "A useful answer", frameOverride: null, styleOverride: null,
  });
  const ids = record.editor.document.slides.map(slide => slide.id);
  return { record, reported: { reviewed_revision: record.editor.revision, reviewed_slide_ids: ids },
    observed: { revision: record.editor.revision, slides: new Set(ids) } };
}

test("completion requires saved, latest previews covering every slide in both observation and report", () => {
  const { record, reported, observed } = project();
  assert.doesNotThrow(() => assertCompleteProjectReview(record, reported, observed, []));
  assert.throws(() => assertCompleteProjectReview(record, reported, undefined, []), { code: "REQUIRED_TOOL_NOT_CALLED" });
  assert.throws(() => assertCompleteProjectReview(record, reported, { ...observed, slides: new Set() }, []), { code: "REVIEW_SLIDES_INCOMPLETE" });
  assert.throws(() => assertCompleteProjectReview(record, { ...reported, reviewed_slide_ids: [] }, observed, []), { code: "REVIEW_SLIDES_INCOMPLETE" });
  assert.throws(() => assertCompleteProjectReview(record, reported, { ...observed, revision: 99 }, []), { code: "REVIEW_REVISION_MISMATCH" });
  record.savedRevision = -1;
  assert.throws(() => assertCompleteProjectReview(record, reported, observed, []), { code: "PROJECT_NOT_SAVED" });
});

test("final validation rejects wrong canvas and empty content before accepting a successful preview", () => {
  const { record, reported, observed } = project();
  record.editor.document.aspectRatio = "9:16";
  assert.throws(() => assertCompleteProjectReview(record, reported, observed, []), { code: "PRODUCTION_ASPECT_RATIO_FIXED" });
  record.editor.document.aspectRatio = "4:5";
  record.editor.document.slides[0].placements.find(placement => placement.id === "copy")!.value = " ";
  assert.throws(() => assertCompleteProjectReview(record, reported, observed, []), { code: "EMPTY_SLIDE" });
});

test("first-draft plans must follow the current pages, including their roles", () => {
  const { record } = project();
  const plan = record.editor.document.slides.map(slide => ({
    slide_id: slide.id, role: slide.role, purpose: "Explain the exercise choice",
    copy: ["A useful answer"], visual: "Show the two choices side by side",
  }));
  assert.doesNotThrow(() => assertCurrentSlidePlan(record, plan));
  for (const invalid of [plan.slice(1), [...plan].reverse(), [plan[0], plan[0]],
    plan.map(item => ({ ...item, role: "cta" as const }))])
    assert.throws(() => assertCurrentSlidePlan(record, invalid), { code: "SLIDE_PLAN_MISMATCH" });
});

test("content completion requires saved content but no previews, badges or visual report",()=>{
  const {record}=project();
  assert.doesNotThrow(()=>assertSavedProjectContent(record));
  record.savedRevision=-1;
  assert.throws(()=>assertSavedProjectContent(record),{code:"PROJECT_NOT_SAVED"});
});
