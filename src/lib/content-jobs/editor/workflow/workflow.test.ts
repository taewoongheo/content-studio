import assert from "node:assert/strict";
import test from "node:test";
import type { CodexJsonValue, CodexUserInput } from "../../../codex/transport/types";
import type { ContentJobInput } from "../../domain/types";
import { ContentJobRegistry, reuseContentJobRegistry } from "../../workflow/registry";
import { BACKGROUND_ELEMENT_ID } from "../document";
import type { ChatRoute, ChatRouter } from "./routing/router";
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

class FakeRouter implements ChatRouter {
  routes: ChatRoute[] = [];
  async route() {
    return this.routes.shift() ?? { capability: "edit_document" as const, proposalSetId: "", candidateId: "" };
  }
}

function setup() {
  const codex = new FakeCodex();
  const router = new FakeRouter();
  const registry = new ContentJobRegistry({ createId: () => "job-1" });
  const job = registry.add(input, "thread-1");
  const service = new EditorWorkflowService(codex, registry, router);
  return { codex, router, registry, job, service };
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

const unchangedStyle = {
  color: null, backgroundColor: null, fontSize: null, fontWeight: null,
  textAlign: null, borderRadius: null, fontFamily: null, imageFit: null,
};

test("선택한 Element의 스타일 속성 하나만 모든 적용 장에 수정한다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis, {
    intent: "edit",
    reply: "본문 제목의 배경만 바꿨습니다.",
    style: { ...unchangedStyle, backgroundColor: "#FF0000" }, frame: null, slotValues: [],
  });
  const ready = await service.initialize(job.id);
  const target = { slideId: "slide-2", placementId: "placement-2-1", elementId: "body-title",
    slideIds: ["slide-2", "slide-3"] };
  const updated = await service.chat(job.id, "배경을 붉게 바꿔줘", ready.editor.revision, target);
  const document = updated.editor.document!;
  assert.equal(document.elements.find((element) => element.id === "body-title")?.style.backgroundColor, "#FF0000");
  assert.equal(document.elements.find((element) => element.id === "body-title")?.style.fontSize, 36);
  assert.equal(document.elements.find((element) => element.id === "hook-title")?.style.backgroundColor, "#FFFFFF");
  assert.deepEqual(updated.editor.messages.at(-2)?.target, target);
  assert.match(codex.inputs[1].find((item) => item.type === "text")?.text ?? "", /"elementId":"body-title"/);
});

test("일부 장만 선택하면 같은 Element의 다른 장은 유지한다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis, {
    intent: "edit",
    reply: "2장만 변경했습니다.", style: { ...unchangedStyle, color: "#FF0000" },
    frame: null, slotValues: [],
  });
  const ready = await service.initialize(job.id);
  const updated = await service.chat(job.id, "이 장의 제목을 빨갛게", ready.editor.revision, {
    slideId: "slide-2", placementId: "placement-2-1", elementId: "body-title", slideIds: ["slide-2"],
  });
  assert.equal(updated.editor.document?.slides[1].placements[0].styleOverride?.color, "#FF0000");
  assert.equal(updated.editor.document?.slides[2].placements[0].styleOverride, null);
  assert.equal(updated.editor.document?.elements.find((element) => element.id === "body-title")?.style.color, "#111111");
});

test("선택한 텍스트 슬롯만 채우고 질문에는 문서를 수정하지 않는다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis, {
    intent: "edit",
    reply: "첫 본문 제목을 바꿨습니다.", style: unchangedStyle, frame: null,
    slotValues: [{ slideId: "slide-2", placementId: "placement-2-1", value: "새 제목" }],
  }, {
    intent: "answer",
    reply: "현재 제목은 새 제목입니다.", style: unchangedStyle, frame: null, slotValues: [],
  });
  const ready = await service.initialize(job.id);
  const target = { slideId: "slide-2", placementId: "placement-2-1", elementId: "body-title",
    slideIds: ["slide-2", "slide-3"] };
  const updated = await service.chat(job.id, "2장 제목만 새 제목으로", ready.editor.revision, target);
  assert.equal(updated.editor.document?.slides[1].placements[0].value, "새 제목");
  assert.equal(updated.editor.document?.slides[2].placements[0].value, "");
  const asked = await service.chat(job.id, "지금 제목이 뭐야?", updated.editor.revision, target);
  assert.deepEqual(asked.editor.document, updated.editor.document);
});

test("선택 범위 밖의 수정과 잘못된 선택 정보는 거부한다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis, {
    intent: "edit",
    reply: "바꿨습니다.", style: unchangedStyle, frame: null,
    slotValues: [{ slideId: "slide-1", placementId: "placement-1-1", value: "잘못된 대상" }],
  });
  const ready = await service.initialize(job.id);
  await assert.rejects(service.chat(job.id, "제목 바꿔줘", ready.editor.revision, {
    slideId: "slide-2", placementId: "placement-2-1", elementId: "body-title", slideIds: ["slide-2"],
  }), /선택 범위 밖/);
  assert.equal(service.get(job.id).editor.document?.slides[0].placements[0].value, "");
  const current = service.get(job.id);
  await assert.rejects(service.chat(job.id, "다시", current.editor.revision, {
    slideId: "slide-2", placementId: "placement-2-1", elementId: "hook-title", slideIds: ["slide-2"],
  }), /선택한 Element/);
  assert.equal(codex.inputs.length, 2);
});

test("수정했다고 답하면서 변경 명령이 없으면 적용하지 않는다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis, {
    intent: "edit", reply: "배경을 바꿨습니다.", style: unchangedStyle, frame: null, slotValues: [],
  });
  const ready = await service.initialize(job.id);
  await assert.rejects(service.chat(job.id, "배경을 빨갛게", ready.editor.revision, {
    slideId: "slide-2", placementId: "placement-2-1", elementId: "body-title", slideIds: ["slide-2"],
  }), /수정 여부/);
  assert.deepEqual(service.get(job.id).editor.document, ready.editor.document);
});

test("선택한 배경은 범위 내 배경색만 바꾸고 다른 스타일 수정은 거부한다", async () => {
  const { codex, job, service } = setup();
  codex.outputs.push(analysis, {
    intent: "edit",
    reply: "배경을 바꿨습니다.", style: { ...unchangedStyle, backgroundColor: "#BB0000" },
    frame: null, slotValues: [],
  }, {
    intent: "edit",
    reply: "변경했습니다.", style: { ...unchangedStyle, color: "#BB0000" },
    frame: null, slotValues: [],
  });
  const ready = await service.initialize(job.id);
  const target = { slideId: "slide-2", placementId: "__background-placement__", elementId: BACKGROUND_ELEMENT_ID,
    slideIds: ["slide-2"] };
  const updated = await service.chat(job.id, "이 장 배경을 붉게", ready.editor.revision, target);
  assert.equal(updated.editor.document?.slides[1].backgroundColor, "#BB0000");
  assert.equal(updated.editor.document?.slides[0].backgroundColor, "#FFFFFF");
  await assert.rejects(service.chat(job.id, "글자색 바꿔줘", updated.editor.revision, target), /배경색만/);
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
  assert.equal(next.editor.proposalSets.find((set) => set.kind === "hook")?.stale, true);
  assert.equal(next.editor.document?.slides[0].placements[0].value, "");
  next = service.undo(job.id, next.editor.revision);
  assert.equal(next.editor.selectedHookId, "hook-1");
  assert.equal(next.editor.hookSuggestions.length, 4);
  assert.equal(next.editor.proposalSets.find((set) => set.kind === "hook")?.stale, false);
  assert.equal(next.editor.document?.slides[0].placements[0].value, "훅 1");
});

test("채팅의 주제 재추천과 후보 수정은 적용 전까지 슬라이드를 바꾸지 않는다", async () => {
  const { codex, router, job, service } = setup();
  router.routes.push(
    { capability: "propose_topics", proposalSetId: "", candidateId: "" },
    { capability: "revise_topic", proposalSetId: "", candidateId: "" },
    { capability: "apply_topic", proposalSetId: "", candidateId: "" },
  );
  codex.outputs.push(analysis, {
    message: "새 주제 세 가지를 제안합니다.",
    topics: [1, 2, 3].map((number) => ({
      id: `topic-${number}`, title: `주제 ${number}`, angle: "운동", rationale: "이유", sourceUrls: [],
    })),
  }, {
    message: "2번 주제를 수정했습니다.",
    topic: { title: "세트 기록의 부담", angle: "기록 시간", rationale: "수정 이유", sourceUrls: [] },
  }, {
    message: "본문을 채웠습니다.",
    slotValues: [2, 3, 4].map((number) => ({
      slideId: `slide-${number}`, placementId: `placement-${number}-1`, value: `본문 ${number}`,
    })),
  });
  let next = await service.initialize(job.id);
  next = await service.chat(job.id, "세트 기록에 관한 주제를 다시 추천해줘", next.editor.revision);
  const set = next.editor.proposalSets[0];
  assert.equal(set.kind, "topic");
  assert.equal(next.editor.selectedTopic, null);
  assert.equal(next.editor.document?.slides[1].placements[0].value, "");
  const target = { setId: set.id, candidateId: "topic-2" };
  next = await service.chat(job.id, "이 주제를 기록 시간 쪽으로 바꿔줘", next.editor.revision, undefined, target);
  assert.equal(next.editor.proposalSets[0].version, 2);
  assert.equal(next.editor.topicSuggestions[1].title, "세트 기록의 부담");
  assert.equal(next.editor.document?.slides[1].placements[0].value, "");
  next = await service.chat(job.id, "이 주제를 적용해줘", next.editor.revision, undefined, target);
  assert.equal(next.editor.selectedTopic?.title, "세트 기록의 부담");
  assert.equal(next.editor.document?.slides[1].placements[0].value, "본문 2");
});

test("훅 제안을 수정해도 적용 전에는 첫 장이 유지되고, 적용 후 수정해도 자동 변경되지 않는다", async () => {
  const { codex, router, registry, job, service } = setup();
  router.routes.push(
    { capability: "propose_hooks", proposalSetId: "", candidateId: "" },
    { capability: "revise_hook", proposalSetId: "", candidateId: "" },
    { capability: "revise_hook", proposalSetId: "", candidateId: "" },
  );
  codex.outputs.push(analysis, {
    message: "훅 네 개를 제안합니다.",
    hooks: [1, 2, 3, 4].map((number) => ({
      id: `hook-${number}`, text: `훅 ${number}`, rationale: "본문과 연결",
    })),
  }, {
    message: "2번을 짧게 바꿨습니다.", hook: { text: "짧은 훅", rationale: "짧고 명료함" },
  }, {
    message: "다시 바꿨습니다.", hook: { text: "새로운 훅", rationale: "다른 표현" },
  });
  let next = await service.initialize(job.id);
  next = registry.update(job.id, (current) => {
    current.editor.bodyReady = true;
    current.editor.document!.slides[1].placements[0].value = "본문 1";
    current.editor.document!.slides[2].placements[0].value = "본문 2";
  });
  next = await service.chat(job.id, "훅을 네 개 추천해줘", next.editor.revision);
  const set = next.editor.proposalSets[0];
  assert.equal(set.kind, "hook");
  assert.equal(next.editor.document?.slides[0].placements[0].value, "");
  const target = { setId: set.id, candidateId: "hook-2" };
  next = await service.chat(job.id, "이 훅을 더 짧게", next.editor.revision, undefined, target);
  assert.equal(next.editor.hookSuggestions[1].text, "짧은 훅");
  assert.equal(next.editor.document?.slides[0].placements[0].value, "");
  next = service.selectHook(job.id, target.candidateId, next.editor.revision, target.setId);
  assert.equal(next.editor.document?.slides[0].placements[0].value, "짧은 훅");
  next = await service.chat(job.id, "다른 표현으로 다시", next.editor.revision, undefined, target);
  assert.equal(next.editor.hookSuggestions[1].text, "새로운 훅");
  assert.equal(next.editor.document?.slides[0].placements[0].value, "짧은 훅");
});

test("채팅에서 훅 작성과 즉시 적용을 한 동작으로 요청할 수 있다", async () => {
  const { codex, router, registry, job, service } = setup();
  router.routes.push({ capability: "write_hook", proposalSetId: "", candidateId: "" });
  codex.outputs.push(analysis, {
    message: "훅을 작성하고 적용했습니다.",
    hook: { text: "세트 사이가 운동을 끊나요?", rationale: "본문의 문제와 연결" },
  });
  let next = await service.initialize(job.id);
  next = registry.update(job.id, (current) => { current.editor.bodyReady = true; });
  next = await service.chat(job.id, "훅 하나를 작성해서 바로 적용해줘", next.editor.revision);
  assert.equal(next.editor.document?.slides[0].placements[0].value, "세트 사이가 운동을 끊나요?");
  assert.equal(next.editor.proposalSets[0].kind, "hook");
  assert.equal(next.editor.selectedHookId, next.editor.proposalSets[0].items[0].id);
});
