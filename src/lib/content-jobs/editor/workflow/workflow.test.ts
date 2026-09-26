import assert from "node:assert/strict";
import test from "node:test";
import type { CodexJsonValue, CodexUserInput } from "../../../codex/transport/types";
import type { ContentJobInput } from "../../domain/types";
import { ContentJobRegistry, reuseContentJobRegistry } from "../../workflow/registry";
import { BACKGROUND_ELEMENT_ID } from "../document";
import { EditorWorkflowService } from "./workflow";

const input: ContentJobInput = {
  model: "gpt-6-luna",
  structure: "repeating",
  productContext: { name: "LiftCode", description: "운동 기록 앱", audience: "운동 사용자", constraints: "과장 금지" },
  aspectRatio: "9:16",
  slideCount: 4,
  outputLanguage: "한국어",
  referenceImages: (["hook", "body", "cta"] as const).map((role, index) => ({
    id: `image-${index + 1}`, name: `${role}.png`, path: `/tmp/${role}.png`, type: "image/png", size: 10, role,
  })),
};

function element(id: string, imageId: string) {
  return {
    id, name: id, role: `${id} 문장`, kind: "text",
    frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
    style: { color: "#111111", backgroundColor: "#FFFFFF", fontSize: 36, fontWeight: 700, textAlign: "center", borderRadius: 0, fontFamily: "sans-serif", imageFit: "cover" },
    sourceImageId: imageId,
  };
}

const analysis = {
  formatNotes: { visualRules: "상단 제목", writingStyle: "짧은 문장", hookPattern: "대조형", bodyProgression: "본문 반복" },
  elements: [element("hook-title", "image-1"), element("body-title", "image-2"), element("cta-title", "image-3")],
  slides: (["hook", "body", "cta"] as const).map((role, index) => ({
    imageId: `image-${index + 1}`, role, backgroundColor: "#FFFFFF", elementIds: [`${role}-title`],
  })),
};

class FakeCodex {
  outputs: CodexJsonValue[] = [];
  threads: string[] = [];
  inputs: CodexUserInput[][] = [];
  async runStructuredTurn({ threadId, input: turnInput }: { threadId: string; input: CodexUserInput[] }) {
    this.threads.push(threadId);
    this.inputs.push(turnInput);
    const output = this.outputs.shift();
    assert.notEqual(output, undefined);
    return { status: "completed" as const, threadId, turnId: `turn-${this.threads.length}`, output: output! };
  }
}

function setup() {
  const codex = new FakeCodex();
  const registry = new ContentJobRegistry({ createId: () => "job-1" });
  const job = registry.add(input, "thread-1");
  const service = new EditorWorkflowService(codex, registry);
  return { codex, registry, job, service };
}

test("레퍼런스 분석으로 JSON 편집 문서를 만들고 같은 Codex thread를 재사용한다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis, {
    message: "세 가지 주제를 찾았습니다.",
    topics: Array.from({ length: 3 }, (_, index) => ({
      id: `topic-${index + 1}`, title: `주제 ${index + 1}`, angle: "문제 해결", rationale: "제품과 적합", sourceUrls: ["https://example.com"],
    })),
  });
  let next = await service.initialize(job.id);
  assert.equal(next.editor.status, "ready");
  assert.equal(next.editor.document?.slides.length, 4);
  next = await service.suggestTopics(job.id, next.editor.revision);
  assert.equal(next.editor.topicSuggestions.length, 3);
  assert.deepEqual(codex.threads, ["thread-1", "thread-1"]);
  assert.equal(codex.inputs[0].filter((item) => item.type === "localImage").length, 3);
  const analysisInstructions = codex.inputs[0].find((item) => item.type === "text")?.text ?? "";
  assert.equal(analysisInstructions.includes("LiftCode"), false);
  assert.match(analysisInstructions, /카피를 작성하지 마세요/);
});

test("개발 서버 재로드 전 생성된 작업에도 편집기 상태를 보완해 분석을 시작한다", async () => {
  const { codex, registry, job } = setup();
  const previousJob = registry.getRecord(job.id);
  delete (previousJob as Partial<typeof previousJob>).editor;
  delete (previousJob as Partial<typeof previousJob>).editorHistory;
  delete (previousJob as Partial<typeof previousJob>).assets;
  Object.setPrototypeOf(registry, {});
  const refreshedRegistry = reuseContentJobRegistry(registry);
  const refreshedService = new EditorWorkflowService(codex, refreshedRegistry);
  const restored = refreshedService.get(job.id);
  assert.equal(restored.editor.status, "pending");
  assert.deepEqual(restored.assets, []);
  codex.outputs.push(analysis);
  const initialized = await refreshedService.initialize(job.id);
  assert.equal(initialized.editor.status, "ready");
});

test("기존 작업의 초기 문구는 비우고 슬롯 정의는 제거하되 실제 편집 내용은 유지한다", async () => {
  const { codex, registry, job, service } = setup();
  codex.outputs.push(analysis);
  await service.initialize(job.id);
  const stored = registry.getRecord(job.id);
  const document = stored.editor.document!;
  const element = document.elements[0];
  const placeholder = "기획하고 다음 세트 정하기";
  (element as typeof element & { slot?: { placeholder: string } }).slot = { placeholder };
  document.slides[0].placements[0].value = placeholder;
  document.slides[1].placements[0].value = "사용자가 직접 쓴 내용";
  const normalized = registry.get(job.id).editor.document!;
  assert.equal("slot" in normalized.elements[0], false);
  assert.equal(normalized.slides[0].placements[0].value, "");
  assert.equal(normalized.slides[1].placements[0].value, "사용자가 직접 쓴 내용");
  assert.equal(normalized.elements[0].role, element.role);
});

test("기존 작업을 다시 읽으면 장별 배경색을 공유 배경 Element로 보완한다", async () => {
  const { codex, registry, job, service } = setup();
  codex.outputs.push(analysis);
  await service.initialize(job.id);
  const stored = registry.getRecord(job.id).editor.document!;
  stored.elements = stored.elements.filter((element) => element.kind !== "background");
  for (const slide of stored.slides) slide.placements = slide.placements.filter((placement) => placement.elementId !== BACKGROUND_ELEMENT_ID);
  stored.slides[1].backgroundColor = "#223344";
  const restored = registry.get(job.id).editor.document!;
  assert.equal(restored.elements.filter((element) => element.kind === "background").length, 1);
  assert.equal(restored.slides[1].placements.at(-1)?.styleOverride?.backgroundColor, "#223344");
  assert.equal(restored.slides[1].placements[0].value, "");
});

test("AI가 전체 배경색을 바꾸면 공유 배경 Element를 수정한다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis, {
    reply: "전체 배경을 바꿨습니다.", backgroundColorAll: "#223344", backgroundUpdates: [],
    newElements: [], newPlacements: [], removedPlacements: [], slotValues: [],
    commonVisualUpdates: [], localVisualUpdates: [], elementUpdates: [],
  });
  const ready = await service.initialize(job.id);
  const updated = await service.chat(job.id, "모든 장의 배경을 어둡게 바꿔줘", ready.editor.revision);
  assert.equal(updated.editor.document?.elements.find((element) => element.id === BACKGROUND_ELEMENT_ID)?.style.backgroundColor, "#223344");
  assert.equal(updated.editor.document?.slides.every((slide) => slide.backgroundColor === "#223344"), true);
});

test("주제 확정은 본문 슬롯을 채우고 훅 선택은 첫 장을 채운다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis, {
    message: "주제 제안",
    topics: Array.from({ length: 3 }, (_, index) => ({
      id: `topic-${index + 1}`, title: `주제 ${index + 1}`, angle: "운동", rationale: "적합", sourceUrls: [],
    })),
  }, {
    message: "본문을 채웠습니다.",
    slotValues: [
      { slideId: "slide-2", placementId: "placement-2-1", value: "첫 동작" },
      { slideId: "slide-3", placementId: "placement-3-1", value: "둘째 동작" },
      { slideId: "slide-4", placementId: "placement-4-1", value: "저장하세요" },
    ],
  }, {
    message: "훅 후보",
    hooks: Array.from({ length: 4 }, (_, index) => ({ id: `hook-${index + 1}`, text: `훅 ${index + 1}`, rationale: "본문과 일치" })),
  });
  let next = await service.initialize(job.id);
  next = await service.suggestTopics(job.id, next.editor.revision);
  next = await service.selectTopic(job.id, "topic-1", next.editor.revision);
  assert.equal(next.editor.bodyReady, true);
  assert.equal(next.editor.document?.slides[1].placements[0].value, "첫 동작");
  next = await service.suggestHooks(job.id, next.editor.revision);
  next = service.selectHook(job.id, "hook-2", next.editor.revision);
  assert.equal(next.editor.document?.slides[0].placements[0].value, "훅 2");
  next = service.undo(job.id, next.editor.revision);
  assert.equal(next.editor.selectedHookId, null);
  assert.equal(next.editor.document?.slides[0].placements[0].value, "");
  next = service.undo(job.id, next.editor.revision);
  assert.equal(next.editor.bodyReady, false);
  assert.equal(next.editor.selectedTopic, null);
  assert.equal(next.editor.document?.slides[1].placements[0].value, "");
  assert.deepEqual(codex.threads, Array(4).fill("thread-1"));
});

test("개별 수정은 되돌릴 수 있고 오래된 revision과 잘못된 AI 명령은 거부한다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis, {
    reply: "변경했습니다.", backgroundColorAll: null, backgroundUpdates: [], newElements: [], newPlacements: [], removedPlacements: [],
    slotValues: [{ slideId: "missing", placementId: "missing", value: "잘못된 수정" }],
    commonVisualUpdates: [], localVisualUpdates: [], elementUpdates: [],
  });
  let next = await service.initialize(job.id);
  const before = next.editor.revision;
  next = service.applyCommands(job.id, [{
    type: "set_slot_value", slideId: "slide-2", placementId: "placement-2-1", value: "직접 입력",
  }], before);
  assert.equal(next.editor.document?.slides[1].placements[0].value, "직접 입력");
  assert.throws(() => service.applyCommands(job.id, [], before));
  await assert.rejects(service.chat(job.id, "첫 장을 고쳐줘", next.editor.revision));
  assert.equal(service.get(job.id).editor.document?.slides[1].placements[0].value, "직접 입력");
  assert.equal(service.get(job.id).editor.messages.at(-1)?.text, "첫 장을 고쳐줘");
  next = service.undo(job.id, service.get(job.id).editor.revision);
  assert.equal(next.editor.document?.slides[1].placements[0].value, "");
});

test("이미지 슬롯에는 업로드하지 않은 ID를 사용할 수 없다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis);
  const ready = await service.initialize(job.id);
  const before = ready.editor.revision;
  assert.throws(() => service.applyCommands(job.id, [
    { type: "add_element", element: { ...element("extra-image", "image-2"), kind: "image" } },
    { type: "place_element", slideId: "slide-2", elementId: "extra-image", placementId: "new-image" },
    { type: "set_slot_value", slideId: "slide-2", placementId: "new-image", value: "unknown-asset" },
  ], before), /업로드된 이미지/);
  assert.equal(service.get(job.id).editor.document?.elements.length, 4);
});

test("본문을 바꾸면 선택된 훅과 후보를 무효화하고 되돌리기는 이전 상태를 복원한다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis, {
    message: "주제 제안",
    topics: Array.from({ length: 3 }, (_, index) => ({
      id: `topic-${index + 1}`, title: `주제 ${index + 1}`, angle: "운동", rationale: "적합", sourceUrls: [],
    })),
  }, {
    message: "본문 완성",
    slotValues: [2, 3, 4].map((number) => ({
      slideId: `slide-${number}`, placementId: `placement-${number}-1`, value: `본문 ${number}`,
    })),
  }, {
    message: "훅 제안",
    hooks: Array.from({ length: 4 }, (_, index) => ({
      id: `hook-${index + 1}`, text: `훅 ${index + 1}`, rationale: "본문 기반",
    })),
  });
  let next = await service.initialize(job.id);
  next = await service.suggestTopics(job.id, next.editor.revision);
  next = await service.selectTopic(job.id, "topic-1", next.editor.revision);
  next = await service.suggestHooks(job.id, next.editor.revision);
  next = service.selectHook(job.id, "hook-1", next.editor.revision);
  next = service.applyCommands(job.id, [{
    type: "set_slot_value", slideId: "slide-2", placementId: "placement-2-1", value: "수정된 본문",
  }], next.editor.revision);
  assert.equal(next.editor.selectedHookId, null);
  assert.deepEqual(next.editor.hookSuggestions, []);
  assert.equal(next.editor.document?.slides[0].placements[0].value, "");
  next = service.undo(job.id, next.editor.revision);
  assert.equal(next.editor.selectedHookId, "hook-1");
  assert.equal(next.editor.hookSuggestions.length, 4);
  assert.equal(next.editor.document?.slides[0].placements[0].value, "훅 1");
});
