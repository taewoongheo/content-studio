import { randomUUID } from "node:crypto";
import { AssetStore, type StoredAsset } from "@/lib/local-db/assets";
import { getLocalDatabase } from "@/lib/local-db/database";
import type { CodexConnectionManager } from "../../../codex/connection/connection";
import type { CodexJsonValue, CodexUserInput } from "../../../codex/transport/types";
import type { ContentJobRecord } from "../../domain/types";
import { ContentJobError, ContentJobRegistry } from "../../workflow/registry";
import { applyEditorCommands, BACKGROUND_ELEMENT_ID, createDocumentFromAnalysis } from "../document";
import { makeElementDefinition } from "../elements/factory";
import { slideActionCommand } from "../slides/commands";
import { editorAnalysisSchema, validateEditorAnalysis, validateEditorCommands } from "../schema";
import type {
  EditorCommand,
  EditorChatTarget,
  EditorDocument,
  EditorHook,
  EditorMessage,
  EditorProposalTarget,
  EditorTopic,
  ElementDefinition,
  ElementFrame,
  ElementStyle,
} from "../types";
import { analysisPrompt, answerPrompt, bodyPrompt, chatPrompt, directHookPrompt, directTopicPrompt, hookRevisionPrompt, hooksPrompt, topicRevisionPrompt, topicsPrompt } from "./prompts";
import { bodyFillSchema, chatAnswerSchema, chatEditSchema, hookRevisionSchema, hookSuggestionsSchema, topicRevisionSchema, topicSuggestionsSchema } from "./schemas";
import { addProposalSet, resolveProposal, reviseHook, reviseTopic, staleHookProposals } from "./proposals/state";
import { type ChatRouter, type ChatRoute } from "./routing/router";
import { executeAgent } from "./orchestration/executor";
import { isProposalInteractive } from "./proposals/lifecycle";
import { duplicateElementCommand, removeElementCommands } from "./actions/commands";
import { elementChoicePrompt, elementChoiceSchema, type ElementChoice } from "./actions/elements";
import { imageChoicePrompt, imageChoiceSchema, type ImageChoice } from "./actions/images";
import { saveChatImages } from "./attachments/chat-images";
import { resolveChatTarget, selectedPlacements, targetedMutationCommands } from "./targeted/chat";
import { targetedChatPrompt } from "./targeted/prompt";
import { targetedChatSchema, type TargetedChatOutput } from "./targeted/schema";
import { validateStructuredOutput } from "../../structured-output/schemas";

type CodexClient = Pick<CodexConnectionManager, "runStructuredTurn">;
type TopicOutput = { message: string; topics: EditorTopic[] };
type BodyOutput = { message: string; slotValues: Array<{ slideId: string; placementId: string; value: string }> };
type HookOutput = { message: string; hooks: EditorHook[] };
type ChatOutput = {
  reply: string;
  backgroundColorAll: string | null;
  backgroundUpdates: Array<{ slideId: string; color: string }>;
  newElements: ElementDefinition[];
  newPlacements: Array<{ slideId: string; elementId: string; placementId: string }>;
  removedPlacements: Array<{ slideId: string; placementId: string }>;
  slotValues: BodyOutput["slotValues"];
  commonVisualUpdates: Array<{ elementId: string; frame: ElementFrame; style: ElementStyle }>;
  localVisualUpdates: Array<{ slideId: string; placementId: string; frame: ElementFrame; style: ElementStyle }>;
  elementUpdates: Array<{ elementId: string; name: string; role: string }>;
};

function invalid(message: string): never {
  throw new ContentJobError("INVALID_OUTPUT", message);
}

function stale(): never {
  throw new ContentJobError("INVALID_STAGE", "편집 문서가 변경되었습니다. 최신 결과를 확인해 주세요.");
}

function invalidSourceUrls(urls: string[]) {
  return urls.some((url) => {
    try { return !["http:", "https:"].includes(new URL(url).protocol); }
    catch { return true; }
  });
}

function readyDocument(job: ContentJobRecord): EditorDocument {
  if (job.editor.status !== "ready" || !job.editor.document)
    throw new ContentJobError("INVALID_STAGE", "레퍼런스 분석이 끝난 뒤 이용할 수 있습니다.");
  return job.editor.document;
}

function sourceImageIdForSlide(job: ContentJobRecord, document: EditorDocument, slideId: string) {
  const originalSlideNumber = /^slide-(\d+)$/.exec(slideId);
  if (originalSlideNumber) {
    const image = job.referenceImages[Number(originalSlideNumber[1]) - 1];
    if (image) return image.id;
  }
  const slide = document.slides.find((item) => item.id === slideId);
  return document.elements.find((element) => slide?.placements.some((placement) =>
    placement.elementId === element.id))?.sourceImageId ?? job.referenceImages[0]?.id ?? "";
}

function assertRevision(job: ContentJobRecord, expected: number) {
  if (job.editor.revision !== expected)
    throw new ContentJobError("INVALID_STAGE", "편집 문서가 변경되었습니다. 최신 결과를 확인해 주세요.");
  if (job.activeOperation)
    throw new ContentJobError("OPERATION_IN_PROGRESS", "AI 작업이 끝난 뒤 수정해 주세요.");
}

function appendMessage(job: ContentJobRecord, role: "user" | "assistant", text: string,
  target?: EditorChatTarget, proposalTarget?: EditorProposalTarget,
  images?: EditorMessage["images"]) {
  const id = randomUUID();
  const proposalSet = job.editor.proposalSets.find((set) => set.id === proposalTarget?.setId);
  const proposal = proposalSet?.items.find((item) => item.id === proposalTarget?.candidateId);
  const proposalLabel = proposal && proposalSet
    ? `${proposalSet.kind === "topic" ? "주제 제안" : "훅 제안"} · ${proposalSet.kind === "topic"
      ? (proposal as EditorTopic).title : (proposal as EditorHook).text}` : undefined;
  job.editor.messages.push({ id, role, text, ...(target ? { target } : {}),
    ...(proposalTarget ? { proposalTarget, proposalLabel } : {}), ...(images?.length ? { images } : {}) });
  if (job.editor.messages.length > 60) job.editor.messages.splice(0, job.editor.messages.length - 60);
  return id;
}

function replaceDocument(job: ContentJobRecord, document: EditorDocument) {
  if (job.editor.document) {
    job.editorHistory.push(structuredClone({
      document: job.editor.document,
      selectedTopic: job.editor.selectedTopic,
      bodyReady: job.editor.bodyReady,
      hookSuggestions: job.editor.hookSuggestions,
      selectedHookId: job.editor.selectedHookId,
      proposalSets: job.editor.proposalSets,
    }));
    if (job.editorHistory.length > 30) job.editorHistory.shift();
  }
  job.editor.document = document;
  job.slideCount = document.slides.length;
  job.editor.revision += 1;
}

function bodySlots(document: EditorDocument) {
  const kinds = new Map(document.elements.map((element) => [element.id, element.kind]));
  return document.slides.filter((slide) => slide.role !== "hook").flatMap((slide) => slide.placements
    .filter((placement) => kinds.get(placement.elementId) === "text")
    .map((placement) => `${slide.id}:${placement.id}`));
}

function hookPlacement(document: EditorDocument) {
  const firstSlide = document.slides.find((slide) => slide.role === "hook") ?? document.slides[0];
  const placement = firstSlide.placements.find((item) =>
    document.elements.some((element) => element.id === item.elementId && element.kind === "text"));
  if (!placement) invalid("훅 텍스트 슬롯을 찾을 수 없습니다.");
  return { slideId: firstSlide.id, placementId: placement.id, value: placement.value };
}

function changedBodyText(before: EditorDocument, after: EditorDocument) {
  const values = (document: EditorDocument) => document.slides.filter((slide) => slide.role !== "hook").flatMap((slide) =>
    slide.placements.filter((placement) => document.elements.some((element) =>
      element.id === placement.elementId && element.kind === "text"))
      .map((placement) => [slide.id, placement.id, placement.value])).sort((a, b) =>
        a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  return JSON.stringify(values(before)) !== JSON.stringify(values(after));
}

function reconcileHook(job: ContentJobRecord, before: EditorDocument, after: EditorDocument) {
  const bodyChanged = changedBodyText(before, after);
  if (!job.editor.selectedHookId) return { document: after, bodyChanged, selectedHookChanged: false };
  const priorHook = hookPlacement(before);
  const nextHook = hookPlacement(after);
  if (!bodyChanged && priorHook.value === nextHook.value)
    return { document: after, bodyChanged: false, selectedHookChanged: false };
  const document = bodyChanged && priorHook.value === nextHook.value
    ? applyEditorCommands(after, [{ type: "set_slot_value", slideId: nextHook.slideId,
      placementId: nextHook.placementId, value: "" }]) : after;
  return { document, bodyChanged, selectedHookChanged: true };
}

function replaceWithReconciliation(job: ContentJobRecord, before: EditorDocument, after: EditorDocument) {
  const result = reconcileHook(job, before, after);
  replaceDocument(job, result.document);
  if (result.bodyChanged) job.editor.hookSuggestions = [];
  if (result.bodyChanged) staleHookProposals(job.editor);
  if (result.selectedHookChanged) job.editor.selectedHookId = null;
}

function assertImageAssets(job: ContentJobRecord, document: EditorDocument) {
  const imageElements = new Set(document.elements.filter((item) => item.kind === "image").map((item) => item.id));
  const assetIds = new Set(job.assets.map((item) => item.id));
  if (document.slides.some((slide) => slide.placements.some((placement) =>
    imageElements.has(placement.elementId) && placement.value !== "" && !assetIds.has(placement.value))))
    invalid("이미지 슬롯은 업로드된 이미지 ID만 사용할 수 있습니다.");
}

function mutationCommands(output: ChatOutput): EditorCommand[] {
  return [
    ...(output.backgroundColorAll ? [{ type: "update_visual" as const, scope: "common" as const,
      elementId: BACKGROUND_ELEMENT_ID, style: { backgroundColor: output.backgroundColorAll } }] : []),
    ...output.backgroundUpdates.map((item): EditorCommand => ({ type: "set_slide_background", ...item })),
    ...output.newElements.map((element): EditorCommand => ({ type: "add_element", element })),
    ...output.newPlacements.map((item): EditorCommand => ({ type: "place_element", ...item })),
    ...output.removedPlacements.map((item): EditorCommand => ({ type: "remove_placement", ...item })),
    ...output.elementUpdates.map((item): EditorCommand => ({ type: "update_element", ...item })),
    ...output.commonVisualUpdates.map((item): EditorCommand => ({ type: "update_visual", scope: "common", ...item })),
    ...output.localVisualUpdates.map((item): EditorCommand => ({ type: "update_visual", scope: "local", ...item })),
    ...output.slotValues.map((item): EditorCommand => ({ type: "set_slot_value", ...item })),
  ];
}

function checkedChatCommands(build: () => EditorCommand[]): EditorCommand[] {
  try { return build(); }
  catch (error) { invalid(error instanceof Error ? error.message : "AI 수정 명령이 올바르지 않습니다."); }
}

function requestedProposal(job: ContentJobRecord, value: unknown): EditorProposalTarget | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) invalid("선택한 제안 정보가 올바르지 않습니다.");
  const target = value as Record<string, unknown>;
  if (typeof target.setId !== "string" || typeof target.candidateId !== "string" ||
    !job.editor.proposalSets.some((set) => set.id === target.setId && isProposalInteractive(job.editor, set) &&
      set.items.some((item) => item.id === target.candidateId)))
    invalid("선택한 제안을 찾을 수 없습니다.");
  return { setId: target.setId, candidateId: target.candidateId };
}

export class EditorWorkflowService {
  private readonly activeChatImages = new WeakMap<ContentJobRecord, CodexUserInput[]>();

  constructor(private readonly codex: CodexClient, private readonly registry: ContentJobRegistry,
    private readonly legacyRouter?: ChatRouter, private readonly assetStore?: AssetStore) {}

  private storedAssets() {
    return this.assetStore ?? new AssetStore(getLocalDatabase());
  }

  get(id: string) {
    return this.registry.get(id);
  }

  private async turn<Value>(job: ContentJobRecord, schema: Record<string, unknown>, input: CodexUserInput[]): Promise<Value> {
    const images = this.activeChatImages.get(job);
    const turn = await this.codex.runStructuredTurn({
      threadId: job.threadId,
      input: images ? [...input, ...images] : input,
      outputSchema: schema as CodexJsonValue,
    });
    if (turn.status !== "completed")
      throw new ContentJobError("CODEX_UNAVAILABLE", turn.message);
    // The same thread retains visual context. Do not resend all attachments at every stage.
    this.activeChatImages.delete(job);
    const result = validateStructuredOutput<Value>(schema, turn.output);
    if (!result.ok) invalid(result.errors.join(" "));
    return result.value;
  }

  private async generateChatEdit(job: ContentJobRecord, document: EditorDocument,
    target: EditorChatTarget | null): Promise<{ reply: string; commands: EditorCommand[] }> {
    if (target) {
      const output = await this.turn<TargetedChatOutput>(job, targetedChatSchema,
        [{ type: "text", text: targetedChatPrompt(job, target) }]);
      return { reply: output.reply,
        commands: checkedChatCommands(() => targetedMutationCommands(document, target, output)) };
    }
    const output = await this.turn<ChatOutput>(job, chatEditSchema, [{ type: "text", text: chatPrompt(job) }]);
    return { reply: output.reply, commands: checkedChatCommands(() => mutationCommands(output)) };
  }

  private commitChatCommands(id: string, job: ContentJobRecord, document: EditorDocument,
    commands: EditorCommand[], reply: string, asset?: StoredAsset) {
    let next: EditorDocument;
    try { next = applyEditorCommands(document, commands); }
    catch (error) { invalid(error instanceof Error ? error.message : "AI 수정 명령이 올바르지 않습니다."); }
    const availableAssets = asset && !job.assets.some((item) => item.id === asset.id)
      ? [...job.assets, { id: asset.id, name: asset.name, type: asset.type, size: asset.size }] : job.assets;
    assertImageAssets({ ...job, assets: availableAssets }, next);
    return this.registry.update(id, (current) => {
      if (asset && !current.assets.some((item) => item.id === asset.id))
        current.assets.push({ id: asset.id, name: asset.name, type: asset.type, size: asset.size });
      if (commands.length > 0) replaceWithReconciliation(current, document, next);
      else current.editor.revision += 1;
      appendMessage(current, "assistant", reply);
    });
  }

  initialize(id: string) {
    return this.registry.runExclusive(id, "initialize_editor", async (job) => {
      if (job.editor.status !== "pending")
        throw new ContentJobError("INVALID_STAGE", "이미 편집기가 준비되었습니다.");
      this.registry.update(id, (current) => { current.editor.status = "analyzing"; });
      try {
        const input: CodexUserInput[] = [{ type: "text", text: analysisPrompt(job) }];
        for (const image of job.referenceImages) {
          input.push({ type: "text", text: `이미지 ID: ${image.id}` });
          input.push({ type: "localImage", path: image.path, detail: "high" });
        }
        const output = await this.turn<unknown>(job, editorAnalysisSchema, input);
        const validated = validateEditorAnalysis(
          output, job.referenceImages.map((image) => image.id), job.structure, job.slideCount,
        );
        if (!validated.ok) invalid(validated.errors.join(" "));
        let document: EditorDocument;
        try {
          document = createDocumentFromAnalysis(validated.value, job.structure, job.slideCount, job.aspectRatio);
        } catch (error) {
          invalid(error instanceof Error ? error.message : "분석 초안이 올바르지 않습니다.");
        }
        return this.registry.update(id, (current) => {
          current.editor.status = "ready";
          current.editor.document = document;
          current.editor.revision += 1;
        });
      } catch (error) {
        this.registry.update(id, (current) => { current.editor.status = "pending"; });
        throw error;
      }
    });
  }

  private async proposeTopics(id: string, job: ContentJobRecord, guidance = "") {
    const output = await this.turn<TopicOutput>(job, topicSuggestionsSchema,
      [{ type: "text", text: topicsPrompt(job, guidance) }]);
    if (new Set(output.topics.map((item) => item.id)).size !== 3 ||
      output.topics.some((item) => !item.title.trim() || invalidSourceUrls(item.sourceUrls)))
      invalid("주제 후보의 ID, 제목 또는 근거 URL이 올바르지 않습니다.");
    return this.registry.update(id, (current) => {
      current.editor.revision += 1;
      const messageId = appendMessage(current, "assistant", output.message);
      addProposalSet(current.editor, "topic", output.topics, messageId);
    });
  }

  suggestTopics(id: string, expectedRevision: number) {
    return this.registry.runExclusive(id, "suggest_topics", async (job) => {
      readyDocument(job);
      if (job.editor.revision !== expectedRevision) stale();
      return this.proposeTopics(id, job);
    });
  }

  private async applyTopic(id: string, job: ContentJobRecord, topic: EditorTopic) {
    const document = readyDocument(job);
    const output = await this.turn<BodyOutput>(job, bodyFillSchema,
      [{ type: "text", text: bodyPrompt(job, topic) }]);
    const expected = bodySlots(document);
    const provided = output.slotValues.map((item) => `${item.slideId}:${item.placementId}`);
    if (expected.length === 0 || provided.length !== expected.length ||
      new Set(provided).size !== provided.length ||
      provided.some((key) => !expected.includes(key)) ||
      output.slotValues.some((item) => !item.value.trim()))
      invalid("본문의 텍스트 슬롯을 모두 정확히 한 번씩 채워야 합니다.");
    const next = applyEditorCommands(document, output.slotValues.map((item) => ({ type: "set_slot_value", ...item })));
    assertImageAssets(job, next);
    return this.registry.update(id, (current) => {
      replaceWithReconciliation(current, document, next);
      current.editor.selectedTopic = structuredClone(topic);
      current.editor.bodyReady = true;
      current.editor.hookSuggestions = [];
      current.editor.selectedHookId = null;
      staleHookProposals(current.editor);
      appendMessage(current, "assistant", output.message);
    });
  }

  selectTopic(id: string, topicId: string, expectedRevision: number, proposalSetId?: string) {
    return this.registry.runExclusive(id, "fill_body", async (job) => {
      readyDocument(job);
      if (job.editor.revision !== expectedRevision) stale();
      const set = proposalSetId
        ? job.editor.proposalSets.find((item) => item.id === proposalSetId && item.kind === "topic")
        : job.editor.proposalSets.findLast((item) => item.kind === "topic" && item.items.some((candidate) => candidate.id === topicId));
      if (proposalSetId && !set) invalid("선택한 주제 제안 묶음을 찾을 수 없습니다.");
      if (set && !isProposalInteractive(job.editor, set)) invalid("이 제안은 비활성화되었습니다. 채팅으로 다시 요청해 주세요.");
      const topic = set && set.kind === "topic" ? set.items.find((item) => item.id === topicId)
        : job.editor.topicSuggestions.find((item) => item.id === topicId);
      if (!topic) invalid("선택한 주제 후보를 찾을 수 없습니다.");
      return this.applyTopic(id, job, topic);
    });
  }

  private async proposeHooks(id: string, job: ContentJobRecord, guidance = "") {
    if (!job.editor.bodyReady) throw new ContentJobError("INVALID_STAGE", "본문을 먼저 완성해 주세요.");
    const output = await this.turn<HookOutput>(job, hookSuggestionsSchema,
      [{ type: "text", text: hooksPrompt(job, guidance) }]);
    if (new Set(output.hooks.map((item) => item.id)).size !== 4 ||
      output.hooks.some((item) => !item.text.trim())) invalid("훅 후보가 올바르지 않습니다.");
    return this.registry.update(id, (current) => {
      current.editor.revision += 1;
      const messageId = appendMessage(current, "assistant", output.message);
      addProposalSet(current.editor, "hook", output.hooks, messageId);
    });
  }

  suggestHooks(id: string, expectedRevision: number) {
    return this.registry.runExclusive(id, "suggest_hooks", async (job) => {
      readyDocument(job);
      if (job.editor.revision !== expectedRevision) stale();
      return this.proposeHooks(id, job);
    });
  }

  private applyHook(id: string, job: ContentJobRecord, hook: EditorHook) {
    const document = readyDocument(job);
    const placement = hookPlacement(document);
    const next = applyEditorCommands(document, [{
      type: "set_slot_value", slideId: placement.slideId, placementId: placement.placementId, value: hook.text,
    }]);
    return this.registry.update(id, (current) => {
      replaceDocument(current, next);
      current.editor.selectedHookId = hook.id;
    });
  }

  selectHook(id: string, hookId: string, expectedRevision: number, proposalSetId?: string) {
    const job = this.registry.getRecord(id);
    assertRevision(job, expectedRevision);
    const set = proposalSetId
      ? job.editor.proposalSets.find((item) => item.id === proposalSetId && item.kind === "hook")
      : job.editor.proposalSets.findLast((item) => item.kind === "hook" && item.items.some((candidate) => candidate.id === hookId));
    if (proposalSetId && !set) invalid("선택한 훅 제안 묶음을 찾을 수 없습니다.");
    if (set?.stale) invalid("본문이 바뀌어 이 훅 제안은 더 이상 적용할 수 없습니다.");
    if (set && !isProposalInteractive(job.editor, set)) invalid("이 제안은 비활성화되었습니다. 채팅으로 다시 요청해 주세요.");
    const hook = set && set.kind === "hook" ? set.items.find((item) => item.id === hookId)
      : job.editor.hookSuggestions.find((item) => item.id === hookId);
    if (!hook) invalid("선택한 훅 후보를 찾을 수 없습니다.");
    return this.applyHook(id, job, hook);
  }

  applyCommands(id: string, commands: unknown, expectedRevision: number) {
    const job = this.registry.getRecord(id);
    assertRevision(job, expectedRevision);
    const document = readyDocument(job);
    const validated = validateEditorCommands({ commands });
    if (!validated.ok) invalid(validated.errors.join(" "));
    let next: EditorDocument;
    try { next = applyEditorCommands(document, validated.value.commands); }
    catch (error) { invalid(error instanceof Error ? error.message : "수정 명령이 올바르지 않습니다."); }
    assertImageAssets(job, next);
    return this.registry.update(id, (current) => { replaceWithReconciliation(current, document, next); });
  }

  undo(id: string, expectedRevision: number) {
    const job = this.registry.getRecord(id);
    assertRevision(job, expectedRevision);
    readyDocument(job);
    if (job.editorHistory.length === 0) invalid("되돌릴 수정이 없습니다.");
    return this.registry.update(id, (current) => {
      const previous = current.editorHistory.pop()!;
      current.editor.document = previous.document;
      current.slideCount = previous.document?.slides.length ?? current.slideCount;
      current.editor.selectedTopic = previous.selectedTopic;
      current.editor.bodyReady = previous.bodyReady;
      current.editor.hookSuggestions = previous.hookSuggestions;
      current.editor.selectedHookId = previous.selectedHookId;
      current.editor.proposalSets = previous.proposalSets;
      current.editor.revision += 1;
    });
  }

  private async executeChatRoute(id: string, job: ContentJobRecord, document: EditorDocument,
    route: ChatRoute, guidance: string, elementTarget: EditorChatTarget | null,
    proposalTarget: EditorProposalTarget | null) {
    switch (route.capability) {
      case "propose_topics":
        return this.proposeTopics(id, job, guidance);
      case "propose_hooks":
        return this.proposeHooks(id, job, guidance);
      case "revise_topic": {
        const target = resolveProposal(job.editor, "topic", route, proposalTarget);
        if (target.set.kind !== "topic") invalid("주제 제안을 선택해 주세요.");
        const topic = target.set.items.find((item) => item.id === target.candidateId)!;
        const output = await this.turn<{ message: string; topic: Omit<EditorTopic, "id"> }>(
          job, topicRevisionSchema, [{ type: "text", text: topicRevisionPrompt(job, topic, guidance) }]);
        if (!output.topic.title.trim() || invalidSourceUrls(output.topic.sourceUrls))
          invalid("수정한 주제의 제목 또는 근거 URL이 올바르지 않습니다.");
        return this.registry.update(id, (current) => {
          current.editor.revision += 1;
          const messageId = appendMessage(current, "assistant", output.message);
          reviseTopic(current.editor, target, output.topic, messageId);
        });
      }
      case "apply_topic": {
        const target = resolveProposal(job.editor, "topic", route, proposalTarget);
        if (target.set.kind !== "topic") invalid("주제 제안을 선택해 주세요.");
        const topic = target.set.items.find((item) => item.id === target.candidateId)!;
        return this.applyTopic(id, job, topic);
      }
      case "draft_topic": {
        const output = await this.turn<{ message: string; topic: Omit<EditorTopic, "id"> }>(
          job, topicRevisionSchema, [{ type: "text", text: directTopicPrompt(job, guidance) }]);
        if (!output.topic.title.trim() || invalidSourceUrls(output.topic.sourceUrls))
          invalid("작성한 주제의 제목 또는 근거 URL이 올바르지 않습니다.");
        const topic = { ...output.topic, id: randomUUID() };
        await this.applyTopic(id, job, topic);
        return this.registry.update(id, (current) => {
          const messageId = appendMessage(current, "assistant", output.message);
          addProposalSet(current.editor, "topic", [topic], messageId);
        });
      }
      case "revise_hook": {
        const target = resolveProposal(job.editor, "hook", route, proposalTarget);
        if (target.set.kind !== "hook") invalid("훅 제안을 선택해 주세요.");
        const hook = target.set.items.find((item) => item.id === target.candidateId)!;
        const output = await this.turn<{ message: string; hook: Omit<EditorHook, "id"> }>(
          job, hookRevisionSchema, [{ type: "text", text: hookRevisionPrompt(job, hook, guidance) }]);
        if (!output.hook.text.trim()) invalid("수정한 훅이 비어 있습니다.");
        return this.registry.update(id, (current) => {
          current.editor.revision += 1;
          const messageId = appendMessage(current, "assistant", output.message);
          reviseHook(current.editor, target, output.hook, messageId);
        });
      }
      case "apply_hook": {
        const target = resolveProposal(job.editor, "hook", route, proposalTarget);
        if (target.set.kind !== "hook") invalid("훅 제안을 선택해 주세요.");
        const hook = target.set.items.find((item) => item.id === target.candidateId)!;
        return this.registry.update(id, (current) => {
          const placement = hookPlacement(document);
          const next = applyEditorCommands(document, [{ type: "set_slot_value",
            slideId: placement.slideId, placementId: placement.placementId, value: hook.text }]);
          replaceDocument(current, next);
          current.editor.selectedHookId = hook.id;
          appendMessage(current, "assistant", "선택한 훅을 첫 장에 적용했습니다.");
        });
      }
      case "write_hook": {
        if (!job.editor.bodyReady) invalid("본문을 먼저 완성해 주세요.");
        const output = await this.turn<{ message: string; hook: Omit<EditorHook, "id"> }>(
          job, hookRevisionSchema, [{ type: "text", text: directHookPrompt(job, guidance) }]);
        if (!output.hook.text.trim()) invalid("작성한 훅이 비어 있습니다.");
        const hook = { ...output.hook, id: randomUUID() };
        this.applyHook(id, job, hook);
        return this.registry.update(id, (current) => {
          const messageId = appendMessage(current, "assistant", output.message);
          addProposalSet(current.editor, "hook", [hook], messageId);
        });
      }
      case "add_element": {
        const choice = await this.turn<ElementChoice>(job, elementChoiceSchema(document),
          [{ type: "text", text: elementChoicePrompt(job, elementTarget) }]);
        if (!choice.name.trim() || !choice.role.trim()) invalid("새 Element의 이름과 역할이 필요합니다.");
        const slide = document.slides.find((item) => item.id === choice.slideId)!;
        const element = makeElementDefinition({ id: randomUUID(), kind: choice.kind,
          name: choice.name, role: choice.role,
          sourceImageId: sourceImageIdForSlide(job, document, slide.id) });
        if (choice.kind !== "text" && choice.value) invalid("도형에는 텍스트 내용을 넣을 수 없습니다.");
        const placementId = randomUUID();
        return this.commitChatCommands(id, job, document, [
          { type: "add_element", element },
          { type: "place_element", slideId: slide.id, elementId: element.id, placementId },
          ...(choice.value ? [{ type: "set_slot_value" as const, slideId: slide.id, placementId, value: choice.value }] : []),
        ], choice.reply);
      }
      case "remove_element": {
        if (!elementTarget) invalid("제거할 Element를 화면에서 선택해 주세요.");
        const commands = checkedChatCommands(() => removeElementCommands(document, elementTarget));
        return this.commitChatCommands(id, job, document, commands,
          `선택한 Element를 ${elementTarget.slideIds.length}장에서 제거했습니다.`);
      }
      case "duplicate_element": {
        if (!elementTarget) invalid("복제할 Element를 화면에서 선택해 주세요.");
        const commands = checkedChatCommands(() => [duplicateElementCommand(document, elementTarget)]);
        return this.commitChatCommands(id, job, document, commands,
          `선택한 Element를 ${elementTarget.slideIds.length}장에 복제했습니다.`);
      }
      case "add_slide":
      case "duplicate_slide":
      case "remove_slide": {
        const capability = route.capability;
        const slideId = route.slideId || elementTarget?.slideId || document.slides[0].id;
        const command = checkedChatCommands(() => [slideActionCommand(document, slideId, capability, randomUUID())]);
        const labels = { add_slide: "빈 슬라이드를 추가했습니다.", duplicate_slide: "슬라이드를 복제했습니다.",
          remove_slide: "슬라이드를 제거했습니다." };
        return this.commitChatCommands(id, job, document, command, labels[capability]);
      }
      case "add_image":
      case "replace_image": {
        const store = this.storedAssets();
        const assets = store.list();
        if (route.capability === "replace_image" && assets.length === 0)
          invalid("저장된 이미지가 없습니다. 이미지를 먼저 업로드해 주세요.");
        const choice = await this.turn<ImageChoice>(job, imageChoiceSchema(document, assets),
          [{ type: "text", text: imageChoicePrompt(job, assets, route.capability, elementTarget) }]);
        const asset = choice.assetId ? store.get(choice.assetId) : null;
        if (choice.assetId && !asset) invalid("저장된 이미지를 찾을 수 없습니다.");
        if (route.capability === "add_image") {
          const slide = document.slides.find((item) => item.id === choice.slideId)!;
          const element = makeElementDefinition({ id: randomUUID(), kind: "image",
            name: asset?.name ?? "새 이미지", role: asset?.description || "이 장의 시각 자료",
            sourceImageId: sourceImageIdForSlide(job, document, slide.id) });
          const placementId = randomUUID();
          return this.commitChatCommands(id, job, document, [
            { type: "add_element", element },
            { type: "place_element", slideId: slide.id, elementId: element.id, placementId },
            ...(asset ? [{ type: "set_slot_value" as const, slideId: slide.id, placementId, value: asset.id }] : []),
          ], choice.reply, asset ?? undefined);
        }
        if (!asset) invalid("교체할 이미지를 저장된 이미지에서 찾지 못했습니다.");
        if (!elementTarget || document.elements.find((item) => item.id === elementTarget.elementId)?.kind !== "image")
          invalid("교체할 이미지 Element를 화면에서 선택해 주세요.");
        const commands = selectedPlacements(document, elementTarget).map(({ slideId, placementId }) => ({
          type: "set_slot_value" as const, slideId, placementId, value: asset.id,
        }));
        return this.commitChatCommands(id, job, document, commands, choice.reply, asset);
      }
      case "edit_image": {
        if (!elementTarget || document.elements.find((item) => item.id === elementTarget.elementId)?.kind !== "image")
          invalid("편집할 이미지 Element를 화면에서 선택해 주세요.");
        const { reply, commands } = await this.generateChatEdit(job, document, elementTarget);
        return this.commitChatCommands(id, job, document, commands, reply);
      }
      case "undo": {
        if (job.editorHistory.length === 0) invalid("되돌릴 수정이 없습니다.");
        return this.registry.update(id, (current) => {
          const previous = current.editorHistory.pop()!;
          current.editor.document = previous.document;
          current.slideCount = previous.document?.slides.length ?? current.slideCount;
          current.editor.selectedTopic = previous.selectedTopic;
          current.editor.bodyReady = previous.bodyReady;
          current.editor.hookSuggestions = previous.hookSuggestions;
          current.editor.selectedHookId = previous.selectedHookId;
          current.editor.proposalSets = previous.proposalSets;
          current.editor.revision += 1;
          appendMessage(current, "assistant", "마지막 문서 변경을 되돌렸습니다.");
        });
      }
      case "answer": {
        const output = await this.turn<{ reply: string }>(job, chatAnswerSchema,
          [{ type: "text", text: answerPrompt(job, elementTarget, proposalTarget) }]);
        return this.registry.update(id, (current) => {
          current.editor.revision += 1;
          appendMessage(current, "assistant", output.reply);
        });
      }
      case "edit_document": {
        const { reply, commands } = await this.generateChatEdit(job, document, elementTarget);
        return this.commitChatCommands(id, job, document, commands, reply);
      }
    }
  }

  private async executeAgentChat(id: string, job: ContentJobRecord, target: EditorChatTarget | null,
    proposalTarget: EditorProposalTarget | null, progressId: string) {
    const progress = (stepId: string, status: "pending" | "running" | "completed", label?: string) => {
      this.registry.update(id, (current) => {
        const execution = current.editor.messages.find((item) => item.id === progressId)!.execution!;
        let step = execution.steps.find((item) => item.id === stepId);
        if (!step) {
          step = { id: stepId, label: label ?? stepId, status };
          execution.steps.push(step);
        }
        step.status = status;
      });
    };
    const before = readyDocument(job);
    const result = await executeAgent({ job, target, proposalTarget,
      turn: (schema, input) => this.turn(job, schema, input), store: () => this.storedAssets(), progress });

    if (result.output.status === "ask_user") return this.registry.update(id, (current) => {
      current.editor.revision += 1;
      appendMessage(current, "assistant", result.output.reply);
    });
    if (result.output.history === "undo") {
      progress("undo", "running", "마지막 변경 되돌리기");
      if (job.editorHistory.length === 0) invalid("되돌릴 수정이 없습니다.");
      const updated = this.registry.update(id, (current) => {
        const previous = current.editorHistory.pop()!;
        current.editor.document = previous.document;
        current.slideCount = previous.document?.slides.length ?? current.slideCount;
        current.editor.selectedTopic = previous.selectedTopic;
        current.editor.bodyReady = previous.bodyReady;
        current.editor.hookSuggestions = previous.hookSuggestions;
        current.editor.selectedHookId = previous.selectedHookId;
        current.editor.proposalSets = previous.proposalSets;
        current.editor.revision += 1;
        appendMessage(current, "assistant", result.output.reply);
      });
      progress("undo", "completed");
      return updated;
    }

    if (result.commands.length) progress("commit", "running", "변경 검증·슬라이드 적용");
    this.registry.update(id, (current) => {
      if (result.commands.length) replaceWithReconciliation(current, before, result.document);
      else current.editor.revision += 1;
      const used = new Set(result.document.slides.flatMap((slide) => slide.placements.map((item) => item.value)));
      for (const asset of result.assets) if (used.has(asset.id) && !current.assets.some((item) => item.id === asset.id))
        current.assets.push({ id: asset.id, name: asset.name, type: asset.type, size: asset.size });
      const messageId = appendMessage(current, "assistant", result.output.reply);
      if (result.output.topics?.length) {
        const set = addProposalSet(current.editor, "topic", result.output.topics, messageId);
        const source = current.editor.proposalSets.find((item) => item.id === proposalTarget?.setId);
        if (source?.kind === "topic") set.version = source.version + 1;
        set.consumed = result.appliedProposal?.kind === "topic" && set.items.some((item) => item.id === result.appliedProposal?.id);
      }
      if (result.output.hooks?.length) {
        const set = addProposalSet(current.editor, "hook", result.output.hooks, messageId);
        const source = current.editor.proposalSets.find((item) => item.id === proposalTarget?.setId);
        if (source?.kind === "hook") set.version = source.version + 1;
        set.consumed = result.appliedProposal?.kind === "hook" && set.items.some((item) => item.id === result.appliedProposal?.id);
      }
      if (result.commands.length) {
        if (result.appliedProposal?.kind === "topic") current.editor.selectedTopic = result.appliedProposal;
        if (result.appliedProposal?.kind === "hook") current.editor.selectedHookId = result.appliedProposal.id;
        const slots = bodySlots(result.document);
        if (slots.length) current.editor.bodyReady = result.document.slides.filter((slide) => slide.role !== "hook").every((slide) =>
          slide.placements.filter((p) => result.document.elements.some((e) => e.id === p.elementId && e.kind === "text"))
            .every((p) => Boolean(p.value.trim())));
      }
    });
    if (result.commands.length) progress("commit", "completed");
    return this.registry.get(id);
  }

  chat(id: string, message: string, expectedRevision: number,
    requestedTarget?: unknown, requestedProposalTarget?: unknown, imageFiles: File[] = []) {
    const trimmed = message.trim();
    if ((!trimmed && imageFiles.length === 0) || trimmed.length > 2000) invalid("메시지는 1~2000자로 입력해 주세요.");
    return this.registry.runExclusive(id, "chat_edit", async (job) => {
      const document = readyDocument(job);
      if (job.editor.revision !== expectedRevision) stale();
      let target: EditorChatTarget | null = null;
      if (requestedTarget !== undefined) {
        try { target = resolveChatTarget(document, requestedTarget); }
        catch (error) { invalid(error instanceof Error ? error.message : "선택한 Element가 올바르지 않습니다."); }
      }
      const proposalTarget = requestedProposal(job, requestedProposalTarget);
      if (target && proposalTarget) invalid("채팅 대상은 Element 또는 제안 하나만 선택해 주세요.");
      const images = await saveChatImages(job, imageFiles);
      const prompt = trimmed || "첨부한 이미지들을 보고 설명해 주세요.";
      this.registry.update(id, (current) => {
        appendMessage(current, "user", prompt, target ?? undefined, proposalTarget ?? undefined,
          images.map(({ id, name, type }) => ({ id, name, type })));
        current.editor.revision += 1;
      });
      if (images.length) this.activeChatImages.set(job, images.map((image) =>
        ({ type: "localImage", path: image.path, detail: "high" })));
      let progressId: string | undefined;
      try {
        if (this.legacyRouter) {
          const route = await this.legacyRouter.route({ job, message: prompt, elementTarget: target, proposalTarget });
          return await this.executeChatRoute(id, job, document, route, prompt, target, proposalTarget);
        }
        this.registry.update(id, (current) => {
          progressId = appendMessage(current, "assistant", "");
          current.editor.messages.find((item) => item.id === progressId)!.execution = { steps: [] };
        });
        return await this.executeAgentChat(id, job, target, proposalTarget, progressId!);
      } catch (error) {
        if (progressId) this.registry.update(id, (current) => {
          const execution = current.editor.messages.find((item) => item.id === progressId)!.execution!;
          execution.error = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
          for (const step of execution.steps) {
            if (step.status === "running") step.status = "failed";
            else if (step.status === "pending") step.status = "skipped";
          }
        });
        throw error;
      } finally {
        this.activeChatImages.delete(job);
      }
    });
  }
}
