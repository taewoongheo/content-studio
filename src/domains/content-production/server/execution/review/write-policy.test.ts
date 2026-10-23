import assert from "node:assert/strict";
import test from "node:test";
import { createBlankDocument } from "@/domains/slideshow/editor/document";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import { assertReviewWrite } from "./write-policy";

test("hook edits cannot alter body, CTA, images, shared styles or slide roles", () => {
  const document = createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 3 });
  document.slides[0].role = "hook";
  document.slides[1].role = "body";
  document.slides[2].role = "cta";
  document.elements.push(makeElementDefinition({ id: "title", kind: "text" }));
  document.slides.forEach(slide => slide.placements.push({
    id: "copy", elementId: "title", value: "Existing copy", frameOverride: null, styleOverride: null,
  }));
  const command = { type: "set_slot_value", slideId: document.slides[0].id, placementId: "copy", value: "Clearer hook" };
  assert.doesNotThrow(() => assertReviewWrite("hook", { commands: [command] }, document));
  assert.doesNotThrow(() => assertReviewWrite("hook", { commands: [{ type: "update_visual", scope: "local", slideId: document.slides[0].id, placementId: "copy", style: { fontSize: 40 } }] }, document));
  for (const rejected of [
    { ...command, slideId: document.slides[1].id },
    { ...command, slideId: document.slides[2].id },
    { type: "update_visual", scope: "common", elementId: "title", style: { fontSize: 40 } },
    { type: "set_slide_role", slideId: document.slides[1].id, role: "hook" },
    { type: "set_local_image", slideId: document.slides[0].id, placementId: "copy" },
  ]) assert.throws(() => assertReviewWrite("hook", { commands: [command, rejected] }, document), /훅 검토/);
  assert.equal(document.slides[1].placements.find(value => value.id === "copy")!.value, "Existing copy");
});

test("visual review allows layout changes and rejects copy or image replacement", () => {
  const document = createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 1 });
  assert.doesNotThrow(() => assertReviewWrite("visual", { commands: [
    { type: "update_visual", scope: "common", elementId: "title", style: { fontSize: 40 } },
    { type: "reorder_layers", slideId: document.slides[0].id, placementIds: [] },
  ] }, document));
  for (const type of ["set_slot_value", "set_local_image", "remove_slide", "set_slide_role", "add_slide", "remove_placement"])
    assert.throws(() => assertReviewWrite("visual", { commands: [{ type }] }, document), /시각 검증/);
});
