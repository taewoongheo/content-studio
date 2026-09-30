import assert from "node:assert/strict";
import test from "node:test";
import type { ElementDefinition, PlacedElement } from "@/lib/content-jobs/editor/types";
import { commandsFromDraft, draftWithFontSize, frameForFontSize, frameWithLockedDimension, makeElementDraft, validElementDraft } from "./element-draft";

const element: ElementDefinition = {
  id: "title", name: "제목", role: "훅", kind: "text",
  frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
  style: { color: "#111111", backgroundColor: "transparent", fontSize: 36,
    fontWeight: 700, textAlign: "center", borderRadius: 0, fontFamily: "sans-serif", imageFit: "cover" },
  sourceImageId: "image-1",
};
const placement: PlacedElement = { id: "placed-title", elementId: "title", value: "현재 제목",
  frameOverride: null, styleOverride: null };
const targets = [{ slideId: "slide-1", placement }];

test("입력 초안은 바뀐 필드만 개별 수정 명령으로 만든다", () => {
  const draft = makeElementDraft(element, placement);
  assert.deepEqual(commandsFromDraft(draft, element, placement, "slide-1", targets, ["slide-1"]), []);
  const changed = { ...draft, value: "새 제목", style: { ...draft.style, color: "#FF0000" } };
  assert.deepEqual(commandsFromDraft(changed, element, placement, "slide-1", [...targets, { slideId: "slide-2", placement: { ...placement, id: "placed-2" } }], ["slide-1"]), [
    { type: "set_slot_value", slideId: "slide-1", placementId: "placed-title", value: "새 제목" },
    { type: "update_visual", scope: "local", slideId: "slide-1", placementId: "placed-title",
      style: { color: "#FF0000" } },
  ]);
});

test("빈 텍스트 슬롯은 내용 입력칸도 비워 둔다", () => {
  const emptyPlacement = { ...placement, value: "" };
  const draft = makeElementDraft(element, emptyPlacement);
  assert.equal(draft.value, "");
  assert.deepEqual(commandsFromDraft(draft, element, emptyPlacement, "slide-1", targets, ["slide-1"]), []);
  assert.deepEqual(commandsFromDraft({ ...draft, value: "새 제목" }, element, emptyPlacement, "slide-1", targets, ["slide-1"]), [
    { type: "set_slot_value", slideId: "slide-1", placementId: "placed-title", value: "새 제목" },
  ]);
});

test("공통 수정은 Element 원본에만 쓰며 유효하지 않은 위치는 저장하지 않는다", () => {
  const draft = makeElementDraft(element, placement);
  assert.deepEqual(commandsFromDraft({ ...draft, frame: { ...draft.frame, x: 0.12 } }, element, placement, "slide-1", targets, ["slide-1"]), [
    { type: "update_visual", scope: "common", elementId: "title", frame: { ...draft.frame, x: 0.12 } },
  ]);
  assert.equal(validElementDraft({ ...draft, frame: { ...draft.frame, x: 0.9 } }), false);
});

test("선택한 슬라이드만 같은 Element의 스타일 분기로 갱신한다", () => {
  const second = { ...placement, id: "placed-2", styleOverride: { color: "#0000FF" } };
  const third = { ...placement, id: "placed-3", styleOverride: { color: "#008800" } };
  const all = [...targets, { slideId: "slide-2", placement: second }, { slideId: "slide-3", placement: third }];
  const draft = makeElementDraft(element, placement);
  const changed = { ...draft, style: { ...draft.style, color: "#FFFF00" } };
  assert.deepEqual(commandsFromDraft(changed, element, placement, "slide-1", all, ["slide-1", "slide-3"]), [
    { type: "update_visual", scope: "local", slideId: "slide-1", placementId: placement.id, style: { color: "#FFFF00" } },
    { type: "update_visual", scope: "local", slideId: "slide-3", placementId: third.id, style: { color: "#FFFF00" } },
  ]);
  assert.deepEqual(commandsFromDraft(changed, element, placement, "slide-1", all, []), []);
  assert.deepEqual(commandsFromDraft(changed, element, placement, "slide-1", all, all.map((target) => target.slideId)), [
    { type: "update_visual", scope: "common", elementId: element.id, style: { color: "#FFFF00" } },
  ]);
});

test("여러 슬라이드 위치 변경은 선택하지 않은 위치 속성을 보존한다", () => {
  const second = { ...placement, id: "placed-2", frameOverride: { ...element.frame, y: 0.4 } };
  const all = [...targets, { slideId: "slide-2", placement: second }, { slideId: "slide-3", placement: { ...placement, id: "placed-3" } }];
  const draft = makeElementDraft(element, placement);
  assert.deepEqual(commandsFromDraft({ ...draft, frame: { ...draft.frame, x: 0.2 } }, element, placement, "slide-1", all, ["slide-2"]), [
    { type: "update_visual", scope: "local", slideId: "slide-2", placementId: second.id,
      frame: { ...second.frameOverride, x: 0.2 } },
  ]);
});

test("현재 장을 제외하면 선택한 장의 시각 값으로 편집한다", () => {
  const second = { ...placement, id: "placed-2", styleOverride: { color: "#0000FF" } };
  const all = [...targets, { slideId: "slide-2", placement: second }];
  const draft = makeElementDraft(element, placement, second);
  assert.equal(draft.style.color, "#0000FF");
  assert.deepEqual(commandsFromDraft(draft, element, placement, "slide-1", all, ["slide-2"], second), []);
  assert.deepEqual(commandsFromDraft({ ...draft, style: { ...draft.style, color: "#FFFF00" } },
    element, placement, "slide-1", all, ["slide-2"], second), [
    { type: "update_visual", scope: "local", slideId: "slide-2", placementId: "placed-2", style: { color: "#FFFF00" } },
  ]);
});

test("글자 크기에 맞춰 텍스트 프레임을 정렬 기준으로 함께 조절한다", () => {
  const frame = { x: 0.3, y: 0.2, width: 0.4, height: 0.1 };
  assert.deepEqual(frameForFontSize(frame, 40, 60, "left"),
    { x: 0.3, y: 0.2, width: 0.6, height: 0.15 });
  assert.deepEqual(frameForFontSize(frame, 40, 60, "center"),
    { x: 0.2, y: 0.2, width: 0.6, height: 0.15 });
  assert.deepEqual(frameForFontSize(frame, 40, 20, "right"),
    { x: 0.5, y: 0.2, width: 0.2, height: 0.05 });
});

test("글자 크기 수정은 스타일과 프레임을 하나의 시각 변경으로 저장한다", () => {
  const draft = draftWithFontSize(makeElementDraft(element, placement), 72);
  assert.deepEqual(commandsFromDraft(draft, element, placement, "slide-1", targets, ["slide-1"]), [
    { type: "update_visual", scope: "common", elementId: "title",
      frame: { x: 0, y: 0.1, width: 1, height: 0.4 }, style: { fontSize: 72 } },
  ]);
});

test("이미지 크기의 한 축을 바꾸면 잠긴 비율대로 다른 축도 바뀐다", () => {
  const frame = { x: 0.1, y: 0.2, width: 0.4, height: 0.2 };
  assert.deepEqual(frameWithLockedDimension(frame, "width", 0.6),
    { x: 0.1, y: 0.2, width: 0.6, height: 0.3 });
  assert.deepEqual(frameWithLockedDimension(frame, "height", 0.1),
    { x: 0.1, y: 0.2, width: 0.2, height: 0.1 });
  assert.deepEqual(frameWithLockedDimension(frame, "width", 2),
    { x: 0.1, y: 0.2, width: 0.9, height: 0.45 });
});
