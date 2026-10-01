import assert from "node:assert/strict";
import test from "node:test";
import { applyEditorCommands, BACKGROUND_PLACEMENT_ID } from "../../../document";
import { validateStructuredOutput } from "../../../../structured-output/schemas";
import { assignServerIds } from "../executor";
import { agentOutputSchema } from "../output-schema";
import { readyJob } from "./fixtures";

test("반복형 본문 순서 변경은 가능하지만 훅·CTA 순서 파괴와 ID 누락은 거부한다", () => {
  const { job } = readyJob();
  const before = job.editor.document!;
  const after = applyEditorCommands(before, [{ type: "reorder_slides", slideIds: ["slide-1", "slide-3", "slide-2", "slide-4"] }]);
  assert.equal(after.slides[1].id, "slide-3");
  assert.equal(before.slides[1].id, "slide-2");
  assert.throws(() => applyEditorCommands(before, [{ type: "reorder_slides", slideIds: ["slide-2", "slide-1", "slide-3", "slide-4"] }]), /순서/);
  assert.throws(() => applyEditorCommands(before, [{ type: "reorder_slides", slideIds: ["slide-1"] }]), /정확히/);
});

test("레이어 순서는 모든 배치 ID를 보존하고 배경 예약 배치를 유지한다", () => {
  const { job } = readyJob();
  const before = job.editor.document!;
  const withExtra = applyEditorCommands(before, [
    { type: "add_element", element: { ...before.elements[0], id: "extra" } },
    { type: "place_element", slideId: "slide-1", elementId: "extra", placementId: "extra-placement" },
  ]);
  const order = ["extra-placement", "placement-1-1", BACKGROUND_PLACEMENT_ID];
  const after = applyEditorCommands(withExtra, [{ type: "reorder_layers", slideId: "slide-1", placementIds: order }]);
  assert.deepEqual(after.slides[0].placements.map((placement) => placement.id), order);
  assert.throws(() => applyEditorCommands(withExtra, [{ type: "reorder_layers", slideId: "slide-1", placementIds: ["extra-placement"] }]), /배경/);
});

test("에이전트 응답은 상태·조회·최종 명령을 하나의 고정 계약으로 제한한다", () => {
  const valid = { status: "complete", reply: "답변", actions: [], topics: [], hooks: [],
    appliedProposalId: "", history: "none", commands: [] };
  assert.equal(validateStructuredOutput(agentOutputSchema, valid).ok, true);
  assert.equal(validateStructuredOutput(agentOutputSchema, { ...valid, unknown: true }).ok, false);
  assert.equal(validateStructuredOutput(agentOutputSchema, { ...valid,
    actions: [{ id: "search", type: "search_assets", queries: ["squat"] }] }).ok, true);
});

test("새 문서 객체의 ID는 앱이 발급하고 같은 배치의 참조도 함께 치환한다", () => {
  let sequence = 0;
  const ids = assignServerIds([
    { type: "add_element", element: { ...readyJob().job.editor.document!.elements[0], id: "new-element" } },
    { type: "place_element", slideId: "slide-2", elementId: "new-element", placementId: "new-placement" },
    { type: "set_slot_value", slideId: "slide-2", placementId: "new-placement", value: "내용" },
  ], () => `server-${++sequence}`);
  assert.equal(ids[0].type === "add_element" && ids[0].element.id, "server-1");
  assert.equal(ids[1].type === "place_element" && ids[1].elementId, "server-1");
  assert.equal(ids[1].type === "place_element" && ids[1].placementId, "server-2");
  assert.equal(ids[2].type === "set_slot_value" && ids[2].placementId, "server-2");
});

test("새 슬라이드의 파생 배치 ID도 앱이 발급한 슬라이드 ID에 맞춰 치환한다", () => {
  const ids = assignServerIds([
    { type: "add_slide", afterSlideId: "slide-2", sourceSlideId: "slide-2", newSlideId: "new-slide", copyContent: false },
    { type: "set_slot_value", slideId: "new-slide", placementId: "new-slide-placement-2-1", value: "새 본문" },
  ], () => "server-slide");
  assert.deepEqual(ids[0], { type: "add_slide", afterSlideId: "slide-2", sourceSlideId: "slide-2",
    newSlideId: "server-slide", copyContent: false });
  assert.deepEqual(ids[1], { type: "set_slot_value", slideId: "server-slide",
    placementId: "server-slide-placement-2-1", value: "새 본문" });
});
