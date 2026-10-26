import assert from "node:assert/strict";
import test from "node:test";
import { createBlankDocument } from "@/domains/slideshow/editor/document";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import { assertStageWrite } from "./index";

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
  assert.doesNotThrow(() => assertStageWrite("hook", { commands: [command] }, document));
  assert.doesNotThrow(() => assertStageWrite("hook", { commands: [{ type: "update_visual", scope: "local", slideId: document.slides[0].id, placementId: "copy", style: { fontSize: 40 } }] }, document));
  for (const rejected of [
    { ...command, slideId: document.slides[1].id },
    { ...command, slideId: document.slides[2].id },
    { type: "update_visual", scope: "common", elementId: "title", style: { fontSize: 40 } },
    { type: "set_slide_role", slideId: document.slides[1].id, role: "hook" },
    { type: "set_local_image", slideId: document.slides[0].id, placementId: "copy" },
  ]) assert.throws(() => assertStageWrite("hook", { commands: [command, rejected] }, document), /훅 검토/);
  assert.equal(document.slides[1].placements.find(value => value.id === "copy")!.value, "Existing copy");
});

test("visual review allows layout changes and rejects copy or image replacement", () => {
  const document = createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 1 });
  assert.doesNotThrow(() => assertStageWrite("visual", { commands: [
    { type: "update_visual", scope: "common", elementId: "title", style: { fontSize: 40 } },
    { type: "reorder_layers", slideId: document.slides[0].id, placementIds: [] },
  ] }, document));
  for (const type of ["set_slot_value", "set_local_image", "remove_slide", "set_slide_role", "add_slide", "remove_placement"])
    assert.throws(() => assertStageWrite("visual", { commands: [{ type }] }, document), /시각 검증/);
});


test("polishing can correct copy on every page but cannot alter styles, images or the badge", () => {
  const document = createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 3 });
  document.elements.push(makeElementDefinition({ id: "copy", kind: "text" }));
  for (const slide of document.slides) slide.placements.push({
    id: "copy", elementId: "copy", value: "Use same weight", frameOverride: null, styleOverride: null,
  });
  const command = { type: "set_slot_value", slideId: document.slides[1].id, placementId: "copy", value: "Use the same weight" };
  assert.doesNotThrow(() => assertStageWrite("polish", { commands: [command] }, document));
  for (const rejected of [
    { ...command, textWeights: [] },
    { ...command, textColors: [] },
    { type: "update_visual", slideId: command.slideId, placementId: "copy", style: { fontSize: 35 } },
    { type: "set_local_image", slideId: command.slideId, placementId: "copy", localPath: "/tmp/image.png" },
    { type: "remove_slide", slideId: command.slideId },
  ]) assert.throws(() => assertStageWrite("polish", { commands: [rejected] }, document), /영어 폴리싱/);
  document.slides[1].placements.find(placement => placement.id === "copy")!.value = "LIFTCODE";
  assert.throws(() => assertStageWrite("polish", { commands: [command] }, document), /영어 폴리싱/);
});


test("production uses fresh image imports and cannot change the fixed canvas ratio", () => {
  const document = createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 1 });
  assert.throws(() => assertStageWrite("production", { commands: [{ type: "set_local_image" }] }, document),
    { code: "GENERATED_IMAGE_IMPORT_REQUIRED" });
  assert.throws(() => assertStageWrite("production", { commands: [{ type: "set_aspect_ratio", aspectRatio: "9:16" }] }, document),
    { code: "PRODUCTION_ASPECT_RATIO_FIXED" });
  assert.doesNotThrow(() => assertStageWrite("production", { commands: [
    { type: "set_aspect_ratio", aspectRatio: "4:5" }, { type: "add_slide" },
  ] }, document));
});
