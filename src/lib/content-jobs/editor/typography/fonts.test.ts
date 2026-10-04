import assert from "node:assert/strict";
import test from "node:test";
import { createBlankDocument, applyEditorCommands, ensureSharedBackground, validateEditorDocument } from "../document";
import { makeElementDefinition } from "../elements/factory";
import { validateEditorCommands } from "../schema";

test("목적별 폰트와 이탤릭은 편집 명령·문서 검증·JSON 왕복에서 지원하고 알 수 없는 폰트는 거부한다", () => {
  const document = createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 3 });
  for (const family of ["anton", "inter", "space-grotesk", "sans-serif"] as const) {
    const element = makeElementDefinition({ id: family, kind: "text" });
    element.style.fontFamily = family;
    element.style.fontStyle = "italic";
    const commands = [{ type: "add_element", element }];
    assert.equal(validateEditorCommands({ commands }).ok, true);
    const next = applyEditorCommands(document, commands as Parameters<typeof applyEditorCommands>[1]);
    assert.deepEqual(validateEditorDocument(JSON.parse(JSON.stringify(next))), []);
  }
  assert.equal(validateEditorCommands({ commands: [{ type: "update_visual", scope: "common",
    elementId: "title", style: { fontFamily: "unknown-font" } }] }).ok, false);
});

test("제거된 폰트와 알 수 없는 기울임 스타일을 새 편집 명령으로 받지 않는다", () => {
  for (const fontFamily of ["bebas-neue", "oswald", "barlow-condensed", "source-sans-3", "serif", "monospace"]) {
    assert.equal(validateEditorCommands({ commands: [{ type: "update_visual", scope: "common", elementId: "title", style: { fontFamily } }] }).ok, false);
  }
  assert.equal(validateEditorCommands({ commands: [{ type: "update_visual", scope: "common", elementId: "title", style: { fontStyle: "oblique" } }] }).ok, false);
});

test("이탤릭 변경은 현재 장·전체 적용·되돌릴 원본 문서와 별도로 보존된다", () => {
  const element = makeElementDefinition({ id: "title", kind: "text" });
  const document = applyEditorCommands(createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 2 }), [
    { type: "add_element", element },
    { type: "place_element", elementId: "title", placementId: "title-1", slideId: "slide-1" },
    { type: "place_element", elementId: "title", placementId: "title-2", slideId: "slide-2" },
  ]);
  const local = applyEditorCommands(document, [{ type: "update_visual", scope: "local", slideId: "slide-1", placementId: "title-1", style: { fontStyle: "italic" } }]);
  assert.equal(local.slides[0].placements.find(p => p.id === "title-1")?.styleOverride?.fontStyle, "italic");
  assert.equal(local.slides[1].placements.find(p => p.id === "title-2")?.styleOverride?.fontStyle, undefined);
  assert.equal(document.slides[0].placements.find(p => p.id === "title-1")?.styleOverride, null);
  const common = applyEditorCommands(local, [{ type: "update_visual", scope: "common", elementId: "title", style: { fontStyle: "normal" } }]);
  assert.equal(common.elements.find(e => e.id === "title")?.style.fontStyle, "normal");
  assert.equal(common.slides[0].placements.find(p => p.id === "title-1")?.styleOverride?.fontStyle, undefined);
  assert.deepEqual(validateEditorDocument(JSON.parse(JSON.stringify(common))), []);
});

test("이전 프로젝트의 제거된 폰트는 정의와 장별 덮어쓰기 모두 대체한다", () => {
  const doc = applyEditorCommands(createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 2 }), [
    { type: "add_element", element: makeElementDefinition({ id: "old", kind: "text" }) },
    { type: "place_element", elementId: "old", slideId: "slide-1", placementId: "old-1" },
  ]);
  const old = doc.elements.find(e => e.id === "old")!;
  old.style.fontFamily = "bebas-neue" as typeof old.style.fontFamily;
  doc.slides[0].placements.find(p => p.id === "old-1")!.styleOverride = { fontFamily: "monospace" as typeof old.style.fontFamily };
  ensureSharedBackground(doc);
  assert.equal(old.style.fontFamily, "anton");
  assert.equal(doc.slides[0].placements.find(p => p.id === "old-1")?.styleOverride?.fontFamily, "sans-serif");
  assert.deepEqual(validateEditorDocument(doc), []);
});
