import { contentJobEvents } from "@/lib/content-jobs/http/events";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { ContentJobInputError } from "@/lib/content-jobs/http/upload";
import {
  contentJobRegistry,
  contentWorkflow,
  editorWorkflow,
} from "@/lib/content-jobs/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ jobId: string }> };
type RegenerationInput = {
  expectedRevision: number;
  guidance: string;
  draft: unknown;
};

function parseOptionalJson(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  try { return JSON.parse(value) as unknown; }
  catch { throw new ContentJobInputError("채팅 대상을 읽을 수 없습니다."); }
}

export async function GET(request: Request, context: Context) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try {
    const { jobId } = await context.params;
    if (request.headers.get("accept")?.includes("text/event-stream"))
      return contentJobEvents(contentJobRegistry, jobId, request.signal);
    return Response.json(contentJobRegistry.get(jobId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  if (!isLocalRequest(request, true))
    return new Response(null, { status: 403 });
  try {
    const { jobId } = await context.params;
    const isChatImage = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = isChatImage ? await request.formData() : null;
    const body: unknown = form ? {
      action: form.get("action"),
      expectedRevision: typeof form.get("expectedRevision") === "string"
        ? Number(form.get("expectedRevision")) : Number.NaN,
      message: form.get("message"),
      target: parseOptionalJson(form.get("target")),
      proposalTarget: parseOptionalJson(form.get("proposalTarget")),
      image: form.get("image"),
    } : await request.json();
    if (typeof body !== "object" || body === null)
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    const input = body as Record<string, unknown>;
    const action = input.action;
    if (form && (action !== "chat_edit" || !(input.image instanceof File)))
      return Response.json({ error: "채팅 이미지 요청이 올바르지 않습니다." }, { status: 400 });
    if (action === "initialize_editor") {
      const running = editorWorkflow.initialize(jobId);
      void running.catch(() => {});
      return Response.json(contentJobRegistry.get(jobId), {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (["suggest_topics", "select_topic", "suggest_hooks", "chat_edit"].includes(String(action))) {
      if (!Number.isInteger(input.expectedRevision))
        return Response.json({ error: "현재 편집 문서의 revision이 필요합니다." }, { status: 400 });
      const revision = input.expectedRevision as number;
      let running: Promise<unknown>;
      switch (action) {
        case "suggest_topics":
          running = editorWorkflow.suggestTopics(jobId, revision);
          break;
        case "select_topic":
          if (typeof input.topicId !== "string")
            return Response.json({ error: "주제를 선택해 주세요." }, { status: 400 });
          running = editorWorkflow.selectTopic(jobId, input.topicId, revision,
            typeof input.proposalSetId === "string" ? input.proposalSetId : undefined);
          break;
        case "suggest_hooks":
          running = editorWorkflow.suggestHooks(jobId, revision);
          break;
        default:
          if (typeof input.message !== "string")
            return Response.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
          running = editorWorkflow.chat(jobId, input.message, revision, input.target, input.proposalTarget,
            input.image instanceof File ? input.image : undefined);
      }
      void running.catch(() => {});
      return Response.json(contentJobRegistry.get(jobId), {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (["editor_command", "editor_undo", "select_editor_hook"].includes(String(action))) {
      if (!Number.isInteger(input.expectedRevision))
        return Response.json({ error: "현재 편집 문서의 revision이 필요합니다." }, { status: 400 });
      const revision = input.expectedRevision as number;
      const job = action === "editor_command"
        ? editorWorkflow.applyCommands(jobId, input.commands, revision)
        : action === "editor_undo"
          ? editorWorkflow.undo(jobId, revision)
          : typeof input.hookId === "string"
            ? editorWorkflow.selectHook(jobId, input.hookId, revision,
              typeof input.proposalSetId === "string" ? input.proposalSetId : undefined)
            : null;
      if (!job) return Response.json({ error: "훅을 선택해 주세요." }, { status: 400 });
      return Response.json(job, { headers: { "Cache-Control": "no-store" } });
    }
    const generation = {
      analyze_reference: () => contentWorkflow.analyzeReference(jobId),
      generate_strategies: () => contentWorkflow.generateStrategies(jobId),
      generate_copy: () => contentWorkflow.generateCopy(jobId),
      generate_hooks: () => contentWorkflow.generateHooks(jobId),
    } as const;
    if (typeof action === "string" && action in generation) {
      const running = generation[action as keyof typeof generation]();
      void running.catch(() => {});
      return Response.json(contentJobRegistry.get(jobId), {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const regeneration = {
      regenerate_reference: (request: RegenerationInput) =>
        contentWorkflow.analyzeReference(jobId, request),
      regenerate_strategy: (request: RegenerationInput) =>
        contentWorkflow.generateStrategies(jobId, request),
      regenerate_copy: (request: RegenerationInput) =>
        contentWorkflow.generateCopy(jobId, request),
      regenerate_hooks: (request: RegenerationInput) =>
        contentWorkflow.generateHooks(jobId, request),
    } as const;
    if (typeof action === "string" && action in regeneration) {
      if (
        !Number.isInteger(input.expectedRevision) ||
        typeof input.guidance !== "string" ||
        input.guidance.trim().length === 0 ||
        input.guidance.length > 2000 ||
        typeof input.draft !== "object" ||
        input.draft === null ||
        Array.isArray(input.draft)
      )
        return Response.json(
          { error: "수정 요청, 편집 초안과 현재 revision을 확인해 주세요." },
          { status: 400 },
        );
      const running = regeneration[action as keyof typeof regeneration]({
        expectedRevision: input.expectedRevision as number,
        guidance: input.guidance,
        draft: input.draft,
      });
      void running.catch(() => {});
      return Response.json(contentJobRegistry.get(jobId), {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!Number.isInteger(input.expectedRevision))
      return Response.json(
        { error: "현재 revision이 필요합니다." },
        { status: 400 },
      );
    const revision = input.expectedRevision as number;
    let job;
    switch (action) {
      case "accept_reference":
        job = contentWorkflow.acceptReference(jobId, input.value, revision);
        break;
      case "accept_strategy":
        if (typeof input.selectedId !== "string")
          return Response.json(
            { error: "선택한 전략이 필요합니다." },
            { status: 400 },
          );
        job = contentWorkflow.acceptStrategy(
          jobId,
          input.value,
          input.selectedId,
          revision,
        );
        break;
      case "accept_copy":
        job = contentWorkflow.acceptCopy(jobId, input.value, revision);
        break;
      case "accept_hook":
        if (typeof input.selectedId !== "string")
          return Response.json(
            { error: "선택한 훅이 필요합니다." },
            { status: 400 },
          );
        job = contentWorkflow.acceptHook(
          jobId,
          input.value,
          input.selectedId,
          revision,
        );
        break;
      case "revise_final":
        if (typeof input.selectedId !== "string")
          return Response.json(
            { error: "선택한 훅이 필요합니다." },
            { status: 400 },
          );
        job = contentWorkflow.reviseFinal(
          jobId,
          input.copy,
          input.hooks,
          input.selectedId,
          revision,
        );
        break;
      default:
        return Response.json(
          { error: "지원하지 않는 작업입니다." },
          { status: 400 },
        );
    }
    return Response.json(job, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}
