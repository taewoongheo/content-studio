import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openLocalDatabase } from "@/lib/local-db/database";
import { AssetStore } from "@/lib/local-db/assets";
import type { CodexJsonValue, CodexUserInput } from "@/lib/codex/transport/types";
import { EditorWorkflowService } from "../../workflow";
import { addProposalSet } from "../../proposals/state";
import { isProposalInteractive } from "../../proposals/lifecycle";
import type { AgentOutput } from "../output-schema";
import { readyJob } from "./fixtures";

const topic = { id: "topic", title: "Sets", angle: "Tracking", rationale: "이유", sourceUrls: [] };
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const complete = (value: Partial<AgentOutput> = {}): AgentOutput => ({
  status: "complete", reply: "완료했습니다.", scope: "document", actions: [], topics: [], hooks: [],
  appliedProposalId: "", history: "none", commands: [], ...value,
});

function setup(outputs: CodexJsonValue[], store?: AssetStore) {
  const { registry, job } = readyJob();
  const calls: Array<{ threadId: string; input: CodexUserInput[] }> = [];
  const service = new EditorWorkflowService({ async runStructuredTurn(request) {
    calls.push(request);
    const output = outputs.shift();
    assert.notEqual(output, undefined);
    return { status: "completed" as const, threadId: request.threadId, turnId: String(calls.length), output: output! };
  } }, registry, undefined, store);
  return { service, registry, job, calls };
}

test("일반 편집은 Codex 한 번과 앱의 원자적 commit으로 끝난다", async () => {
  const { service, registry, job, calls } = setup([complete({ reply: "내용을 채웠습니다.", commands: [2, 3, 4].map((i) => ({
    type: "set_slot_value", slideId: `slide-${i}`, placementId: `placement-${i}-1`, value: `English body ${i}`,
  })) })]);
  const states: string[] = [];
  const stop = registry.subscribe(job.id, (state) => {
    const steps = state.editor.messages.find((message) => message.execution)?.execution?.steps ?? [];
    states.push(steps.filter((step) => step.status === "running").map((step) => step.id).join(","));
  });
  const result = await service.chat(job.id, "전체를 영어로 채워줘", 0);
  stop();
  assert.equal(calls.length, 1);
  assert.equal(result.editor.document!.slides[1].placements[0].value, "English body 2");
  assert.equal(result.editor.bodyReady, true);
  assert.equal(job.editorHistory.length, 1);
  assert.deepEqual(result.editor.messages.find((message) => message.execution)!.execution!.steps,
    [{ id: "plan-0", label: "요청 이해·작업 계획", status: "completed" },
      { id: "validate", label: "편집 명령 검증", status: "completed" },
      { id: "commit", label: "변경 검증·슬라이드 적용", status: "completed" }]);
  assert.equal(states.includes("plan-0"), true);
  assert.equal(states.includes("commit"), true);
});

test("편집 명령의 사용자 문구가 비어도 앱이 완료 문구를 보완한다", async () => {
  const { service, job } = setup([complete({ reply: "", scope: "selection", commands: [
    { type: "set_slot_value", slideId: "slide-1", placementId: "placement-1-1", value: "Updated" },
  ] })]);
  const result = await service.chat(job.id, "이 제목을 바꿔줘", 0,
    { slideId: "slide-1", placementId: "placement-1-1", elementId: "title", slideIds: ["slide-1"] });
  assert.equal(result.editor.document!.slides[0].placements[0].value, "Updated");
  assert.equal(result.editor.messages.at(-1)?.text, "요청한 변경을 적용했습니다.");
});

test("선택한 제안의 수정 결과는 새 카드가 되고 이전 카드는 다음 메시지부터 비활성화된다", async () => {
  const revised = { ...topic, id: "revised", title: "Short sets" };
  const { service, job } = setup([complete({ reply: "수정했습니다.", topics: [revised] })]);
  job.editor.messages.push({ id: "proposal", role: "assistant", text: "주제 후보" });
  const set = addProposalSet(job.editor, "topic", [topic], "proposal");
  const target = { setId: set.id, candidateId: topic.id };
  const result = await service.chat(job.id, "짧게 바꿔줘", 0, undefined, target);
  assert.equal(isProposalInteractive(result.editor, result.editor.proposalSets[0]), false);
  assert.equal(isProposalInteractive(result.editor, result.editor.proposalSets[1]), true);
  assert.equal(result.editor.proposalSets[1].version, 2);
  assert.equal(result.editor.document!.slides[0].placements[0].value, "");
  await assert.rejects(service.selectTopic(job.id, topic.id, result.editor.revision, set.id), /비활성화/);
});

test("선택하지 않고 메시지를 보내도 직전 제안은 비활성화된다", async () => {
  const { service, job } = setup([complete({ reply: "차이를 설명했습니다." })]);
  job.editor.messages.push({ id: "proposal", role: "assistant", text: "후보" });
  addProposalSet(job.editor, "topic", [topic], "proposal");
  const result = await service.chat(job.id, "이 주제들의 차이를 설명해", 0);
  assert.equal(isProposalInteractive(result.editor, result.editor.proposalSets[0]), false);
});

test("잘못된 명령이 하나라도 있으면 문서와 undo 이력을 전혀 변경하지 않는다", async () => {
  const { service, job } = setup([complete({ commands: [
    { type: "set_slot_value", slideId: "slide-1", placementId: "placement-1-1", value: "변경" },
    { type: "set_slot_value", slideId: "missing", placementId: "missing", value: "오류" },
  ] })]);
  const before = structuredClone(job.editor.document);
  await assert.rejects(service.chat(job.id, "전체 수정", 0), /슬라이드/);
  assert.deepEqual(job.editor.document, before);
  assert.equal(job.editorHistory.length, 0);
  assert.equal(job.editor.messages.find((message) => message.execution)!.execution!.steps
    .find((step) => step.id === "plan-0")!.status, "completed");
});

test("선택 범위 밖의 유효한 JSON 명령도 실행하지 않는다", async () => {
  const { service } = setup([complete({ scope: "selection", commands: [
    { type: "set_slot_value", slideId: "slide-3", placementId: "placement-3-1", value: "범위 밖" },
  ] })]);
  await assert.rejects(service.chat("job", "이 제목만 수정", 0,
    { slideId: "slide-2", placementId: "placement-2-1", elementId: "title", slideIds: ["slide-2"] }), /범위 밖/);
});

test("에셋 검색이 필요할 때만 결과를 같은 thread의 다음 Codex 호출로 전달한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "content-studio-agent-assets-"));
  const database = openLocalDatabase(join(directory, "test.sqlite"));
  try {
    const store = new AssetStore(database);
    const relevant = store.create({ name: "스쿼트", description: "squat 운동", type: "image/png", bytes: png });
    store.create({ name: "관련없는 자료", description: "irrelevant", type: "image/png", bytes: png });
    const search = complete({ status: "actions", reply: "이미지를 찾습니다.", actions: [
      { id: "search-squat", type: "search_assets", queries: ["스쿼트 squat"] },
    ] });
    const { service, job, calls } = setup([search, complete({ reply: "수정했습니다.", commands: [
      { type: "set_slot_value", slideId: "slide-2", placementId: "placement-2-1", value: "Squat" },
    ] })], store);
    job.referenceImages = [{ id: "ref", name: "ref.png", type: "image/png", size: 8,
      role: null, path: join(directory, "ref.png") }];
    await service.chat(job.id, "첨부 운동으로 채워. 이미지는 풀에서", 0, undefined, undefined,
      [new File([png], "one.png", { type: "image/png" })]);
    assert.deepEqual(calls.map((call) => call.threadId), ["thread-1", "thread-1"]);
    assert.deepEqual(calls.map((call) => call.input.filter((item) => item.type === "localImage").length), [1, 0]);
    const prompt = calls[1].input[0];
    assert.equal(prompt.type, "text");
    if (prompt.type === "text") {
      assert.match(prompt.text, new RegExp(relevant.id));
      assert.doesNotMatch(prompt.text, /irrelevant/);
    }
  } finally { database.close(); await rm(directory, { recursive: true, force: true }); }
});

test("사용자만 답할 수 있는 정보는 문서를 바꾸지 않고 질문으로 끝낸다", async () => {
  const { service, job, calls } = setup([complete({ status: "ask_user", reply: "어느 캐릭터를 사용할까요?" })]);
  const before = structuredClone(job.editor.document);
  const result = await service.chat(job.id, "캐릭터를 넣어줘", 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(result.editor.document, before);
  assert.equal(result.editor.messages.at(-1)?.text, "어느 캐릭터를 사용할까요?");
});

test("동일한 조회를 결과 확인 후 다시 요청하면 진행 없음으로 중단한다", async () => {
  const repeat = complete({ status: "actions", reply: "검색합니다.", actions: [
    { id: "search", type: "search_assets", queries: ["squat"] },
  ] });
  const { service, job, calls } = setup([repeat, repeat]);
  await assert.rejects(service.chat(job.id, "이미지 찾아줘", 0), /같은 조회/);
  assert.equal(calls.length, 2);
  assert.equal(job.editorHistory.length, 0);
});

test("조회하지 않은 에셋 ID를 문서에 삽입할 수 없다", async () => {
  const { service, job } = setup([complete({ commands: [
    { type: "add_element", element: { ...jobElement(), id: "image", kind: "image" } },
    { type: "place_element", slideId: "slide-2", elementId: "image", placementId: "image-placement" },
    { type: "set_slot_value", slideId: "slide-2", placementId: "image-placement", value: "invented-id" },
  ] })]);
  await assert.rejects(service.chat(job.id, "이미지 추가", 0), /에셋 ID/);
});

function jobElement() {
  return { id: "template", name: "이미지", role: "시각 자료", kind: "image" as const, sourceImageId: "image-2",
    frame: { x: 0.1, y: 0.3, width: 0.8, height: 0.5 }, style: { color: "#111111", backgroundColor: "transparent",
      fontSize: 36, lineHeight: 1.2, fontWeight: 700, textAlign: "center" as const, borderRadius: 0,
      fontFamily: "sans-serif" as const, imageFit: "contain" as const } };
}
