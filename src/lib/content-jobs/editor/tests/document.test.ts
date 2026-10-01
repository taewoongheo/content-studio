import assert from "node:assert/strict";
import test from "node:test";
import {
  applyEditorCommand,
  applyEditorCommands,
  createDocumentFromAnalysis as buildDocument,
  ensureSharedBackground,
  BACKGROUND_ELEMENT_ID,
  BACKGROUND_PLACEMENT_ID,
  validateEditorDocument,
} from "../document";
import type { SlideshowStructure } from "../../domain/types";
import type { EditorAnalysis, EditorDocument } from "../types";

const analysis: EditorAnalysis = {
  elements: [
    {
      id: "title",
      name: "동작 이름",
      role: "각 장의 동작을 알린다",
      kind: "text",
      frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.12 },
      style: {
        color: "#111111",
        backgroundColor: "#FFFFFF",
        fontSize: 42,
        lineHeight: 1.2,
        fontWeight: 700,
        textAlign: "center",
        borderRadius: 0,
        fontFamily: "sans-serif",
        imageFit: "cover",
      },
      sourceImageId: "image-2",
    },
  ],
  formatNotes: { visualRules: "상단 제목", writingStyle: "짧은 문장", hookPattern: "문제 제기", bodyProgression: "동작별 반복" },
  slides: [
    { imageId: "image-1", role: "hook", backgroundColor: "#FFFFFF", elementIds: [], visuals: [] },
    { imageId: "image-2", role: "body", backgroundColor: "#FFFFFF", elementIds: ["title"], visuals: [] },
    { imageId: "image-3", role: "cta", backgroundColor: "#FFFFFF", elementIds: [], visuals: [] },
  ],
};

function createDocumentFromAnalysis(source: EditorAnalysis, structure: SlideshowStructure,
  slideCount: number, aspectRatio: EditorDocument["aspectRatio"]) {
  const slides = source.slides.length === slideCount ? source.slides : Array.from({ length: slideCount }, (_, index) => ({
    ...source.slides[index === 0 ? 0 : index === slideCount - 1 ? 2 : 1],
    imageId: `image-${index + 1}`,
  }));
  return buildDocument({ ...source, slides }, structure, slideCount, aspectRatio);
}

test("반복형 분석의 공통 Element를 각 본문 슬라이드에 배치한다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 5, "9:16");
  assert.deepEqual(document.slides.map((slide) => slide.role), ["hook", "body", "body", "body", "cta"]);
  assert.equal(document.elements.length, 2);
  assert.equal(document.elements.filter((element) => element.kind === "background").length, 1);
  assert.equal(document.slides.every((slide) => slide.placements.at(-1)?.elementId === BACKGROUND_ELEMENT_ID), true);
  assert.equal(document.formatNotes.bodyProgression, "동작별 반복");
  assert.equal(document.slides[1].placements[0].elementId, "title");
  assert.equal(document.slides[1].placements[0].value, "");
  assert.equal(document.slides.every((slide) => slide.placements.every((placement) => placement.value === "")), true);
  assert.equal(document.slides[3].placements[0].elementId, "title");
  assert.notEqual(document.slides[1].placements[0].id, document.slides[3].placements[0].id);
  assert.deepEqual(validateEditorDocument(document), []);
});

test("Element와 개별 배치는 슬라이드 바깥 프레임을 허용한다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 3, "4:5");
  const title = document.elements.find((element) => element.id === "title");
  assert.ok(title);
  title.frame = { x: -0.2, y: 0.9, width: 1.4, height: 0.3 };
  document.slides[1].placements[0].frameOverride = { x: 1.1, y: -0.2, width: 0.4, height: 0.5 };
  assert.deepEqual(validateEditorDocument(document), []);
});

test("모든 레퍼런스 장을 그대로 만들면서 반복 Element ID를 공유한다", () => {
  const source: EditorAnalysis = {
    ...analysis,
    elements: [...analysis.elements, { ...analysis.elements[0], id: "detail", sourceImageId: "image-3" }],
    slides: [analysis.slides[0], analysis.slides[1],
      { imageId: "image-3", role: "body", backgroundColor: "#222222", elementIds: ["title", "detail"],
        visuals: [{ elementId: "title", frame: { x: 0.2, y: 0.2, width: 0.7, height: 0.12 },
          style: { ...analysis.elements[0].style, color: "#FF0000" } }] },
      { ...analysis.slides[2], imageId: "image-4" }],
  };
  const document = buildDocument(source, "repeating", 4, "9:16");
  assert.equal(document.slides[2].backgroundColor, "#222222");
  assert.deepEqual(document.slides[1].placements.map((item) => item.elementId), ["title", BACKGROUND_ELEMENT_ID]);
  assert.deepEqual(document.slides[2].placements.map((item) => item.elementId), ["title", "detail", BACKGROUND_ELEMENT_ID]);
  assert.notEqual(document.slides[1].placements[0].id, document.slides[2].placements[0].id);
  assert.equal(document.slides[1].placements[0].frameOverride, null);
  assert.equal(document.slides[2].placements[0].frameOverride?.x, 0.2);
  assert.equal(document.slides[2].placements[0].styleOverride?.color, "#FF0000");
});

test("반복형 본문 장을 비워 추가하거나 내용을 복제하고, 필수 장 제거는 막는다", () => {
  const initial = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const filled = applyEditorCommand(initial, { type: "set_slot_value", slideId: "slide-2",
    placementId: "placement-2-1", value: "스쿼트" });
  const added = applyEditorCommand(filled, { type: "add_slide", afterSlideId: "slide-2",
    sourceSlideId: "slide-2", newSlideId: "new-body", copyContent: false });
  assert.deepEqual(added.slides.map((slide) => slide.role), ["hook", "body", "body", "body", "cta"]);
  assert.equal(added.slides[2].placements[0].elementId, "title");
  assert.equal(added.slides[2].placements[0].value, "");
  assert.equal(added.slides[2].placements.at(-1)?.elementId, BACKGROUND_ELEMENT_ID);
  const copied = applyEditorCommand(filled, { type: "add_slide", afterSlideId: "slide-2",
    sourceSlideId: "slide-2", newSlideId: "copied-body", copyContent: true });
  assert.equal(copied.slides[2].placements[0].value, "스쿼트");
  const removed = applyEditorCommand(added, { type: "remove_slide", slideId: "new-body" });
  assert.equal(removed.slides.length, 4);
  assert.deepEqual(validateEditorDocument(removed), []);
  assert.throws(() => applyEditorCommand(initial, { type: "remove_slide", slideId: "slide-1" }), /훅과 CTA/);
  assert.throws(() => applyEditorCommand(initial, { type: "remove_slide", slideId: "slide-4" }), /훅과 CTA/);
  assert.throws(() => applyEditorCommand(initial, { type: "add_slide", afterSlideId: "slide-4",
    sourceSlideId: "slide-2", newSlideId: "too-late", copyContent: false }), /본문 장 사이/);
  assert.throws(() => applyEditorCommand(initial, { type: "add_slide", afterSlideId: "slide-2",
    sourceSlideId: "slide-2", newSlideId: "", copyContent: false }), /슬라이드 ID/);
  const three = applyEditorCommand(initial, { type: "remove_slide", slideId: "slide-2" });
  assert.throws(() => applyEditorCommand(three, { type: "remove_slide", slideId: "slide-3" }), /필수 슬라이드/);
});

test("배경은 모든 장이 공유하는 삭제 불가 Element이며 기존 장별 색을 보존한다", () => {
  const document = createDocumentFromAnalysis({ ...analysis, slides: analysis.slides.map((slide, index) => ({
    ...slide, backgroundColor: index === 1 ? "#222222" : "#FFFFFF",
  })) }, "repeating", 5, "9:16");
  assert.equal(document.slides.every((slide) => slide.placements.at(-1)?.id === BACKGROUND_PLACEMENT_ID), true);
  assert.equal(document.slides[1].placements.at(-1)?.styleOverride?.backgroundColor, "#222222");
  assert.equal(document.slides[2].placements.at(-1)?.styleOverride?.backgroundColor, "#222222");
  assert.throws(() => applyEditorCommand(document, { type: "remove_placement", slideId: "slide-2", placementId: BACKGROUND_PLACEMENT_ID }), /배경/);
  assert.throws(() => applyEditorCommand(document, { type: "set_slot_value", slideId: "slide-2", placementId: BACKGROUND_PLACEMENT_ID, value: "텍스트" }), /배경/);
  assert.throws(() => applyEditorCommand(document, { type: "duplicate_placement",
    sourceSlideId: "slide-2", sourcePlacementId: BACKGROUND_PLACEMENT_ID, newElementId: "bg-copy",
    placements: [{ slideId: "slide-2", sourcePlacementId: BACKGROUND_PLACEMENT_ID, newPlacementId: "bg-copy-placement" }] }), /배경/);
  const unified = applyEditorCommand(document, { type: "update_visual", scope: "common",
    elementId: BACKGROUND_ELEMENT_ID, style: { backgroundColor: "#FF0000" } });
  assert.equal(unified.slides.every((slide) => slide.backgroundColor === "#FF0000"), true);
  assert.equal(unified.slides.every((slide) => slide.placements.at(-1)?.styleOverride === null), true);
});

test("기존 문서에 배경 Element를 추가해도 장별 색과 텍스트 배치 순서를 유지한다", () => {
  const current = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const legacy = structuredClone(current);
  delete (legacy.elements[0].style as Partial<typeof legacy.elements[0]["style"]>).lineHeight;
  legacy.elements = legacy.elements.filter((element) => element.id !== BACKGROUND_ELEMENT_ID);
  for (const slide of legacy.slides) slide.placements = slide.placements.filter((placement) => placement.elementId !== BACKGROUND_ELEMENT_ID);
  legacy.slides[2].backgroundColor = "#0000FF";
  ensureSharedBackground(legacy);
  ensureSharedBackground(legacy);
  assert.deepEqual(validateEditorDocument(legacy), []);
  assert.equal(legacy.elements[0].style.lineHeight, 1.2);
  assert.equal(legacy.slides[1].placements[0].elementId, "title");
  assert.equal(legacy.slides[2].placements.at(-1)?.styleOverride?.backgroundColor, "#0000FF");
  assert.equal(legacy.slides.every((slide) => slide.placements.filter((placement) => placement.elementId === BACKGROUND_ELEMENT_ID).length === 1), true);
});

test("개별 스타일 수정은 한 장에만, 공통 수정은 모든 배치에 적용한다", () => {
  const initial = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const body = initial.slides[1];
  const local = applyEditorCommand(initial, {
    type: "update_visual",
    scope: "local",
    slideId: body.id,
    placementId: body.placements[0].id,
    frame: { x: 0.2, y: 0.1, width: 0.7, height: 0.12 },
  });
  assert.equal(local.slides[1].placements[0].frameOverride?.x, 0.2);
  assert.equal(local.slides[2].placements[0].frameOverride, null);

  const localColor = applyEditorCommand(local, {
    type: "update_visual",
    scope: "local",
    slideId: body.id,
    placementId: body.placements[0].id,
    style: { color: "#0000FF" },
  });

  const common = applyEditorCommand(localColor, {
    type: "update_visual",
    scope: "common",
    elementId: "title",
    style: { color: "#FF0000" },
  });
  assert.equal(common.elements[0].style.color, "#FF0000");
  assert.equal(common.slides[1].placements[0].styleOverride?.color, undefined);
  assert.equal(common.slides[2].placements[0].frameOverride, null);
  assert.equal(initial.elements[0].style.color, "#111111");
});

test("같은 Element는 서로 다른 색을 가진 뒤 전체 색 변경으로 다시 통일할 수 있다", () => {
  let document = createDocumentFromAnalysis(analysis, "repeating", 5, "9:16");
  for (const [index, color] of [[1, "#FF0000"], [2, "#0000FF"]] as const) {
    const slide = document.slides[index];
    document = applyEditorCommand(document, { type: "update_visual", scope: "local", slideId: slide.id,
      placementId: slide.placements[0].id, style: { backgroundColor: color } });
  }
  assert.equal(document.elements.length, 2);
  assert.equal(document.slides[1].placements[0].styleOverride?.backgroundColor, "#FF0000");
  assert.equal(document.slides[2].placements[0].styleOverride?.backgroundColor, "#0000FF");
  const unified = applyEditorCommand(document, { type: "update_visual", scope: "common", elementId: "title",
    style: { backgroundColor: "#FFFF00" } });
  assert.equal(unified.elements.length, 2);
  assert.equal(unified.elements[0].style.backgroundColor, "#FFFF00");
  assert.equal(unified.slides[1].placements[0].styleOverride, null);
  assert.equal(unified.slides[2].placements[0].styleOverride, null);
});

test("존재하지 않는 Element와 양수가 아닌 크기는 거부한다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  assert.throws(() => applyEditorCommand(document, {
    type: "place_element",
    slideId: "slide-1",
    elementId: "missing",
    placementId: "new-placement",
  }));
  assert.throws(() => applyEditorCommand(document, {
    type: "update_visual",
    scope: "common",
    elementId: "title",
    frame: { x: 0.9, y: 0.1, width: 0, height: 0.1 },
  }));
});

test("Element 슬롯 값은 지정한 슬라이드의 배치에만 반영된다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const body = document.slides[1];
  const edited = applyEditorCommand(document, {
    type: "set_slot_value",
    slideId: body.id,
    placementId: body.placements[0].id,
    value: "스쿼트",
  });
  assert.equal(edited.slides[1].placements[0].value, "스쿼트");
  assert.equal(edited.slides[2].placements[0].value, "");
});

test("텍스트 Element를 새 장에 놓아도 내용은 비어 있다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const placed = applyEditorCommand(document, {
    type: "place_element", slideId: "slide-1", elementId: "title", placementId: "new-title",
  });
  assert.equal(placed.slides[0].placements[0].value, "");
});

test("일반 Element를 모두 제거해도 배경은 남는다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const slide = document.slides[1];
  const edited = applyEditorCommand(document, { type: "remove_placement", slideId: slide.id,
    placementId: slide.placements[0].id });
  assert.deepEqual(edited.slides[1].placements.map((placement) => placement.elementId), [BACKGROUND_ELEMENT_ID]);
  assert.deepEqual(validateEditorDocument(edited), []);
});

test("포맷 규칙은 시각 수정 이후에도 생성 맥락으로 보존된다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const edited = applyEditorCommand(document, {
    type: "set_slide_background", slideId: "slide-2", color: "#222222",
  });
  assert.equal(edited.formatNotes.writingStyle, "짧은 문장");
  assert.equal(document.formatNotes.writingStyle, "짧은 문장");
});

test("슬라이드 배경도 JSON 수정 명령으로 변경한다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const edited = applyEditorCommand(document, { type: "set_slide_background", slideId: "slide-2", color: "#202020" });
  assert.equal(edited.slides[1].backgroundColor, "#202020");
  assert.equal(document.slides[1].backgroundColor, "#FFFFFF");
  assert.throws(() => applyEditorCommand(document, { type: "set_slide_background", slideId: "slide-2", color: "red" }));
});

test("공유 Element 복제는 원본이 놓인 모든 장에 새 공유 원본과 개별 내용을 복제한다", () => {
  const initial = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const first = applyEditorCommand(initial, { type: "set_slot_value", slideId: "slide-2", placementId: "placement-2-1", value: "스쿼트" });
  const second = applyEditorCommand(first, { type: "set_slot_value", slideId: "slide-3", placementId: "placement-3-1", value: "데드리프트" });
  const duplicated = applyEditorCommand(second, {
    type: "duplicate_placement", sourceSlideId: "slide-2", sourcePlacementId: "placement-2-1",
    newElementId: "title-copy",
    placements: [
      { slideId: "slide-2", sourcePlacementId: "placement-2-1", newPlacementId: "copy-2" },
      { slideId: "slide-3", sourcePlacementId: "placement-3-1", newPlacementId: "copy-3" },
    ],
  });
  assert.equal(duplicated.elements.length, 3);
  assert.equal(duplicated.elements.find((element) => element.id === "title-copy")?.name, "동작 이름 복사본");
  assert.equal(duplicated.slides[1].placements[1].elementId, "title-copy");
  assert.equal(duplicated.slides[2].placements[1].elementId, "title-copy");
  assert.equal(duplicated.slides[1].placements[1].value, "스쿼트");
  assert.equal(duplicated.slides[2].placements[1].value, "데드리프트");
  assert.equal(second.elements.length, 2);
});

test("선택한 장만 복제하면 독립 Element가 만들어지고 다른 Element 배치는 거부한다", () => {
  const initial = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const duplicated = applyEditorCommand(initial, {
    type: "duplicate_placement", sourceSlideId: "slide-2", sourcePlacementId: "placement-2-1",
    newElementId: "local-copy",
    placements: [{ slideId: "slide-2", sourcePlacementId: "placement-2-1", newPlacementId: "copy-2" }],
  });
  assert.equal(duplicated.slides[1].placements.length, 3);
  assert.equal(duplicated.slides[2].placements.length, 2);
  assert.throws(() => applyEditorCommand(initial, {
    type: "duplicate_placement", sourceSlideId: "slide-2", sourcePlacementId: "placement-2-1",
    newElementId: "invalid-copy",
    placements: [{ slideId: "slide-2", sourcePlacementId: "__background-placement__", newPlacementId: "copy-2" }],
  }), /모든 배치/);
});

test("선택한 일부 장에서만 공유 Element를 복제한다", () => {
  const initial = createDocumentFromAnalysis(analysis, "repeating", 5, "9:16");
  const duplicated = applyEditorCommand(initial, {
    type: "duplicate_placement", sourceSlideId: "slide-2", sourcePlacementId: "placement-2-1",
    newElementId: "partial-copy",
    placements: [
      { slideId: "slide-2", sourcePlacementId: "placement-2-1", newPlacementId: "copy-2" },
      { slideId: "slide-4", sourcePlacementId: "placement-4-1", newPlacementId: "copy-4" },
    ],
  });
  assert.equal(duplicated.slides[1].placements[1].elementId, "partial-copy");
  assert.equal(duplicated.slides[2].placements.some((placement) => placement.elementId === "partial-copy"), false);
  assert.equal(duplicated.slides[3].placements[1].elementId, "partial-copy");
});

test("선택한 일부 장에서만 공유 Element 배치를 제거한다", () => {
  const initial = createDocumentFromAnalysis(analysis, "repeating", 5, "9:16");
  const removed = applyEditorCommands(initial, [
    { type: "remove_placement", slideId: "slide-2", placementId: "placement-2-1" },
    { type: "remove_placement", slideId: "slide-4", placementId: "placement-4-1" },
  ]);
  assert.equal(removed.slides[1].placements.some((placement) => placement.elementId === "title"), false);
  assert.equal(removed.slides[2].placements.some((placement) => placement.elementId === "title"), true);
  assert.equal(removed.slides[3].placements.some((placement) => placement.elementId === "title"), false);
  assert.equal(initial.slides[1].placements.some((placement) => placement.elementId === "title"), true);
});

test("사각형·원형·삼각형 Element를 편집 문서에 추가할 수 있다", () => {
  const initial = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  for (const kind of ["rectangle", "circle", "triangle"] as const) {
    const shape = { ...analysis.elements[0], id: `shape-${kind}`, name: `${kind} 도형`, kind,
      style: { ...analysis.elements[0].style, backgroundColor: "#FF0000" } };
    const next = applyEditorCommand(initial, { type: "add_element", element: shape });
    assert.equal(next.elements.at(-1)?.kind, kind);
    assert.deepEqual(validateEditorDocument(next), []);
  }
});
