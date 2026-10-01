import assert from "node:assert/strict";
import test from "node:test";
import { validateEditorAnalysis, validateEditorCommands } from "../schema";

const element = {
  id: "heading",
  name: "제목",
  role: "관심을 끈다",
  kind: "text",
  frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.15 },
  style: {
    color: "#111111",
    backgroundColor: "#FFFFFF",
    fontSize: 36,
    lineHeight: 1.2,
    fontWeight: 700,
    textAlign: "center",
    borderRadius: 0,
    fontFamily: "sans-serif",
    imageFit: "cover",
  },
  sourceImageId: "image-1",
};

test("AI 분석은 입력 이미지, 역할, Element 참조를 검증한다", () => {
  const valid = {
    elements: [
      element,
      { ...element, id: "body", sourceImageId: "image-2" },
      { ...element, id: "cta", sourceImageId: "image-4" },
    ],
    formatNotes: { visualRules: "상단 제목", writingStyle: "짧음", hookPattern: "질문형", bodyProgression: "반복" },
    slides: [
      { imageId: "image-1", role: "hook", backgroundColor: "#FFFFFF", elementIds: ["heading"], visuals: [] },
      { imageId: "image-2", role: "body", backgroundColor: "#FFFFFF", elementIds: ["body"], visuals: [] },
      { imageId: "image-3", role: "body", backgroundColor: "#FFFFFF", elementIds: ["body"], visuals: [] },
      { imageId: "image-4", role: "cta", backgroundColor: "#FFFFFF", elementIds: ["cta"], visuals: [] },
    ],
  };
  const imageIds = ["image-1", "image-2", "image-3", "image-4"];
  assert.equal(validateEditorAnalysis(valid, imageIds, "repeating", 4).ok, true);
  assert.equal(validateEditorAnalysis({ ...valid, elements: [
    { ...element, slot: { placeholder: "완성된 문구" } }, ...valid.elements.slice(1),
  ] }, imageIds, "repeating", 4).ok, false);
  assert.equal(validateEditorAnalysis({ ...valid, slides: [
    { ...valid.slides[0], elementIds: ["missing"] }, ...valid.slides.slice(1),
  ] }, imageIds, "repeating", 4).ok, false);
  assert.equal(validateEditorAnalysis({ ...valid, slides: [
    { ...valid.slides[0], role: "body" }, ...valid.slides.slice(1),
  ] }, imageIds, "repeating", 4).ok, false);
  assert.equal(validateEditorAnalysis({ ...valid, slides: [
    valid.slides[0], valid.slides[1], { ...valid.slides[2], elementIds: ["heading"] }, valid.slides[3],
  ] }, imageIds, "repeating", 4).ok, false);
  assert.equal(validateEditorAnalysis(valid, imageIds.slice(0, 3), "repeating", 4).ok, false);
});

test("AI 수정 명령은 허용된 종류와 필드만 받는다", () => {
  assert.equal(validateEditorCommands({ commands: [{
    type: "set_slot_value", slideId: "slide-1", placementId: "placement-1-1", value: "새 제목",
  }] }).ok, true);
  assert.equal(validateEditorCommands({ commands: [{ type: "delete_all" }] }).ok, false);
  assert.equal(validateEditorCommands({ commands: [{ type: "duplicate_placement",
    sourceSlideId: "slide-2", sourcePlacementId: "placement-2-1", newElementId: "copy",
    placements: [{ slideId: "slide-2", sourcePlacementId: "placement-2-1", newPlacementId: "new-placement" }],
  }] }).ok, true);
  assert.equal(validateEditorCommands({ commands: [{
    type: "set_slot_value", slideId: "slide-1", placementId: "placement-1-1", value: "새 제목", extra: true,
  }] }).ok, false);
});
