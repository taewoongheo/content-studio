import { randomUUID } from "node:crypto";
import type { CodexConnectionManager } from "../../../codex/connection/connection";
import type { CodexJsonValue, CodexUserInput } from "../../../codex/transport/types";
import type { ContentJobRecord } from "../../domain/types";
import { ContentJobError, ContentJobRegistry } from "../../workflow/registry";
import { applyEditorCommands, BACKGROUND_ELEMENT_ID, createDocumentFromAnalysis } from "../document";
import { editorAnalysisSchema, validateEditorAnalysis, validateEditorCommands } from "../schema";
import type {
  EditorCommand,
  EditorChatTarget,
  EditorDocument,
  EditorHook,
  EditorTopic,
  ElementDefinition,
  ElementFrame,
  ElementStyle,
} from "../types";
import { analysisPrompt, bodyPrompt, chatPrompt, hooksPrompt, topicsPrompt } from "./prompts";
import { bodyFillSchema, chatEditSchema, hookSuggestionsSchema, topicSuggestionsSchema } from "./schemas";
import { resolveChatTarget, targetedMutationCommands } from "./targeted/chat";
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

function readyDocument(job: ContentJobRecord): EditorDocument {
  if (job.editor.status !== "ready" || !job.editor.document)
    throw new ContentJobError("INVALID_STAGE", "레퍼런스 분석이 끝난 뒤 이용할 수 있습니다.");
  return job.editor.document;
}

function assertRevision(job: ContentJobRecord, expected: number) {
  if (job.editor.revision !== expected)
    throw new ContentJobError("INVALID_STAGE", "편집 문서가 변경되었습니다. 최신 결과를 확인해 주세요.");
  if (job.activeOperation)
    throw new ContentJobError("OPERATION_IN_PROGRESS", "AI 작업이 끝난 뒤 수정해 주세요.");
}

function appendMessage(job: ContentJobRecord, role: "user" | "assistant", text: string, target?: EditorChatTarget) {
  job.editor.messages.push({ id: randomUUID(), role, text, ...(target ? { target } : {}) });
  if (job.editor.messages.length > 60) job.editor.messages.splice(0, job.editor.messages.length - 60);
}

function replaceDocument(job: ContentJobRecord, document: EditorDocument) {
  if (job.editor.document) {
    job.editorHistory.push(structuredClone({
      document: job.editor.document,
      selectedTopic: job.editor.selectedTopic,
      bodyReady: job.editor.bodyReady,
      hookSuggestions: job.editor.hookSuggestions,
      selectedHookId: job.editor.selectedHookId,
    }));
    if (job.editorHistory.length > 30) job.editorHistory.shift();
  }
  job.editor.document = document;
  job.editor.revision += 1;
}

function bodySlots(document: EditorDocument) {
  const kinds = new Map(document.elements.map((element) => [element.id, element.kind]));
  return document.slides.slice(1).flatMap((slide) => slide.placements
    .filter((placement) => kinds.get(placement.elementId) === "text")
    .map((placement) => `${slide.id}:${placement.id}`));
}

function hookPlacement(document: EditorDocument) {
  const firstSlide = document.slides[0];
  const placement = firstSlide.placements.find((item) =>
    document.elements.some((element) => element.id === item.elementId && element.kind === "text"));
  if (!placement) invalid("훅 텍스트 슬롯을 찾을 수 없습니다.");
  return { slideId: firstSlide.id, placementId: placement.id, value: placement.value };
}

function changedBodyText(before: EditorDocument, after: EditorDocument) {
  const values = (document: EditorDocument) => document.slides.slice(1).flatMap((slide) =>
    slide.placements.filter((placement) => document.elements.some((element) =>
      element.id === placement.elementId && element.kind === "text"))
      .map((placement) => [slide.id, placement.id, placement.value]));
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

export class EditorWorkflowService {
  constructor(private readonly codex: CodexClient, private readonly registry: ContentJobRegistry) {}

  get(id: string) {
    return this.registry.get(id);
  }

  private async turn<Value>(job: ContentJobRecord, schema: Record<string, unknown>, input: CodexUserInput[]): Promise<Value> {
    const turn = await this.codex.runStructuredTurn({
      threadId: job.threadId,
      input,
      outputSchema: schema as CodexJsonValue,
    });
    if (turn.status !== "completed")
      throw new ContentJobError("CODEX_UNAVAILABLE", turn.message);
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

  suggestTopics(id: string, expectedRevision: number) {
    return this.registry.runExclusive(id, "suggest_topics", async (job) => {
      readyDocument(job);
      if (job.editor.revision !== expectedRevision) stale();
      const output = await this.turn<TopicOutput>(job, topicSuggestionsSchema, [{ type: "text", text: topicsPrompt(job) }]);
      if (new Set(output.topics.map((item) => item.id)).size !== 3 ||
        output.topics.some((item) => !item.title.trim() || item.sourceUrls.some((url) => {
          try { return !["http:", "https:"].includes(new URL(url).protocol); } catch { return true; }
        }))) invalid("주제 후보의 ID, 제목 또는 근거 URL이 올바르지 않습니다.");
      return this.registry.update(id, (current) => {
        current.editor.topicSuggestions = output.topics;
        current.editor.revision += 1;
        appendMessage(current, "assistant", output.message);
      });
    });
  }

  selectTopic(id: string, topicId: string, expectedRevision: number) {
    return this.registry.runExclusive(id, "fill_body", async (job) => {
      const document = readyDocument(job);
      if (job.editor.revision !== expectedRevision) stale();
      const topic = job.editor.topicSuggestions.find((item) => item.id === topicId);
      if (!topic) invalid("선택한 주제 후보를 찾을 수 없습니다.");
      const output = await this.turn<BodyOutput>(job, bodyFillSchema, [{ type: "text", text: bodyPrompt(job, topic) }]);
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
        current.editor.selectedTopic = topic;
        current.editor.bodyReady = true;
        current.editor.hookSuggestions = [];
        current.editor.selectedHookId = null;
        appendMessage(current, "assistant", output.message);
      });
    });
  }

  suggestHooks(id: string, expectedRevision: number) {
    return this.registry.runExclusive(id, "suggest_hooks", async (job) => {
      readyDocument(job);
      if (!job.editor.bodyReady) throw new ContentJobError("INVALID_STAGE", "본문을 먼저 완성해 주세요.");
      if (job.editor.revision !== expectedRevision) stale();
      const output = await this.turn<HookOutput>(job, hookSuggestionsSchema, [{ type: "text", text: hooksPrompt(job) }]);
      if (new Set(output.hooks.map((item) => item.id)).size !== 4 ||
        output.hooks.some((item) => !item.text.trim())) invalid("훅 후보가 올바르지 않습니다.");
      return this.registry.update(id, (current) => {
        current.editor.hookSuggestions = output.hooks;
        current.editor.revision += 1;
        appendMessage(current, "assistant", output.message);
      });
    });
  }

  selectHook(id: string, hookId: string, expectedRevision: number) {
    const job = this.registry.getRecord(id);
    assertRevision(job, expectedRevision);
    const document = readyDocument(job);
    const hook = job.editor.hookSuggestions.find((item) => item.id === hookId);
    if (!hook) invalid("선택한 훅 후보를 찾을 수 없습니다.");
    const placement = hookPlacement(document);
    const next = applyEditorCommands(document, [{
      type: "set_slot_value", slideId: placement.slideId, placementId: placement.placementId, value: hook.text,
    }]);
    return this.registry.update(id, (current) => {
      replaceDocument(current, next);
      current.editor.selectedHookId = hookId;
    });
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
      current.editor.selectedTopic = previous.selectedTopic;
      current.editor.bodyReady = previous.bodyReady;
      current.editor.hookSuggestions = previous.hookSuggestions;
      current.editor.selectedHookId = previous.selectedHookId;
      current.editor.revision += 1;
    });
  }

  chat(id: string, message: string, expectedRevision: number, requestedTarget?: unknown) {
    const trimmed = message.trim();
    if (!trimmed || trimmed.length > 2000) invalid("메시지는 1~2000자로 입력해 주세요.");
    return this.registry.runExclusive(id, "chat_edit", async (job) => {
      const document = readyDocument(job);
      if (job.editor.revision !== expectedRevision) stale();
      let target: EditorChatTarget | null = null;
      if (requestedTarget !== undefined) {
        try { target = resolveChatTarget(document, requestedTarget); }
        catch (error) { invalid(error instanceof Error ? error.message : "선택한 Element가 올바르지 않습니다."); }
      }
      this.registry.update(id, (current) => {
        appendMessage(current, "user", trimmed, target ?? undefined);
        current.editor.revision += 1;
      });
      const { reply, commands } = await this.generateChatEdit(job, document, target);
      let next: EditorDocument;
      try { next = applyEditorCommands(document, commands); }
      catch (error) { invalid(error instanceof Error ? error.message : "AI 수정 명령이 올바르지 않습니다."); }
      assertImageAssets(job, next);
      return this.registry.update(id, (current) => {
        if (commands.length > 0) replaceWithReconciliation(current, document, next);
        else current.editor.revision += 1;
        appendMessage(current, "assistant", reply);
      });
    });
  }
}
