import { answerText } from "./answer";
import { assistantContext } from "./context";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCodex } from "@/lib/ai/codex";
import { OperationError } from "@/lib/errors/operation";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { readVideo, subscribeVideoTabs } from "@/domains/video/server/service";
import { listOpenProjectTabs } from "../../server/tabs";
import type { AssistantState, AssistantTarget, AssistantSelection } from "../model";
import { assistantPrompt, responseSchema } from "./prompt";

type Session = { promptVersion?: number; target: AssistantTarget; directory: Promise<string>; threadId?: string; status: AssistantState; run?: AssistantRun };
export type AssistantRun = { id: string; token: string; controller: AbortController; phase: "inspect" | "edit";
  target: AssistantTarget; reviewedRevision?: number; slides: Set<string>; affectedSlides: Set<string>; changed: boolean };
const global = globalThis as typeof globalThis & { editorAssistantSessions?: Map<string, Session>; editorAssistantSubscribed?: boolean };
const sessions = global.editorAssistantSessions ??= new Map<string, Session>();
const idle = (): AssistantState => ({ state: "idle", phase: "", text: "", suggestion: "", error: "", changed: false });
export function assistantSnapshot(target: AssistantTarget) {
  const snapshot = target.projectType === "video" ? readVideo(target.projectId) : contentJobRegistry.get(target.projectId);
  if (snapshot.tabId !== target.tabId) throw new OperationError("TAB_CONFLICT", "종료된 에디터입니다. 다시 열어 주세요.");
  return snapshot;
}
export function assistantStatus(target: AssistantTarget) {
  assistantSnapshot(target);
  return sessions.get(target.tabId)?.status ?? idle();
}
export function authorizeAssistant(tabId: string, authorization: string | null) {
  const session = sessions.get(tabId), run = session?.run;
  if (!run || run.controller.signal.aborted || authorization !== `Bearer ${run.token}`)
    throw new OperationError("RUN_EXPIRED", "종료된 AI 실행입니다.");
  assistantSnapshot(run.target);
  return run;
}
export function stopAssistant(tabId: string) {
  const session = sessions.get(tabId);
  session?.run?.controller.abort();
  if (session?.run) session.status = { ...session.status, state: "stopped", phase: "중단됨" };
}
function reconcile() {
  const open = new Set(listOpenProjectTabs().map(tab => tab.tabId));
  for (const [id, session] of sessions) if (!open.has(id)) {
    session.run?.controller.abort(); sessions.delete(id);
    void session.directory.then(directory => rm(directory, { recursive: true, force: true }));
  }
}
function subscribe() {
  if (global.editorAssistantSubscribed) return;
  global.editorAssistantSubscribed = true;
  contentJobRegistry.subscribeTabs(reconcile); subscribeVideoTabs(reconcile);
}
export function startAssistant(target: AssistantTarget, selection: AssistantSelection, message: string, requestId: string, origin: string, executeCli: typeof runCodex = runCodex) {
  const snapshot = assistantSnapshot(target);
  subscribe();
  let session = sessions.get(target.tabId);
  if (session?.status.requestId === requestId) return session.status;
  if (session?.run) throw new OperationError("ASSISTANT_BUSY", "이 탭의 AI가 작업 중입니다.");
  if (!session) {
    session = { target, directory: mkdtemp(join(tmpdir(), "editor-assistant-")), status: idle() };
    sessions.set(target.tabId, session);
  }
  if (session.promptVersion !== 2) { session.threadId = undefined; session.promptVersion = 2; }
  const run: AssistantRun = { id: randomUUID(), token: randomUUID(), controller: new AbortController(), phase: "edit", target, slides: new Set(), affectedSlides: new Set(), changed: false };
  session.run = run;
  session.status = { ...idle(), requestId, command: message, state: "running", phase: "명령 확인 중" };
  void execute(session, run, selection, message, snapshot, origin, executeCli);
  return session.status;
}
async function execute(session: Session, run: AssistantRun, selection: AssistantSelection, message: string,
  snapshot: ReturnType<typeof assistantSnapshot>, origin: string, executeCli: typeof runCodex) {
  const timeout = setTimeout(() => run.controller.abort(new DOMException("AI 실행 시간이 초과됐습니다.", "TimeoutError")), 20 * 60_000);
  try {
    const directory = await session.directory;
    const result = await executeCli({ model: "gpt-6.1-sol", standalone: true,
      conversation: { directory, threadId: session.threadId },
      capabilities: { webSearch: true, shell: false, imageGeneration: true },
      prompt: assistantPrompt(run.target, selection, message, assistantContext(snapshot)),
      schema: responseSchema, origin, taskId: run.target.tabId, token: run.token,
      toolUrl: `${origin}/api/editor-assistant/${run.target.tabId}/agent`, signal: run.controller.signal,
      onThreadStarted(id) { session.threadId = id; },
      onActivity(activity) {
        session.status.phase = activity === "mcp_tool_call" ? "문서 확인·편집 중" : activity === "image_generation" ? "이미지 생성 중" : "답변 준비 중";
      },
      onAgentMessage(text) {
        const answer = answerText(text);
        if (answer !== undefined) session.status.text = answer;
      },
    });
    run.controller.signal.throwIfAborted();
    if (result.kind === "answer" && !run.changed) {
      session.status = { ...session.status, state: "completed", phase: "", text: String(result.text), suggestion: String(result.suggestion) };
      return;
    }
    const latest = assistantSnapshot(run.target);
    const revision = "editor" in latest ? latest.editor.revision : latest.revision;
    const pendingSlides = "editor" in latest
      ? latest.editor.document.slides.filter(slide => run.affectedSlides.has(slide.id)) : [];
    const needsReview = !("editor" in latest) || pendingSlides.length > 0;
    if (run.changed && needsReview && (run.reviewedRevision !== revision || pendingSlides.some(slide => !run.slides.has(slide.id))))
      throw new Error("수정은 저장됐지만 최종 시각 확인이 완료되지 않았습니다. 기존 되돌리기를 사용할 수 있습니다.");
    if (!run.changed) throw new Error("수정이 적용되지 않았습니다. 명령을 구체적으로 다시 입력해 주세요.");
    session.status = { ...session.status, state: "completed", phase: "완료", text: String(result.text ?? ""), suggestion: "", changed: true };
  } catch (error) {
    // Failed/cancelled turns have uncertain context; the next command starts with the saved editor state.
    session.threadId = undefined;
    const reason = run.controller.signal.reason;
    const stopped = run.controller.signal.aborted && reason?.name !== "TimeoutError";
    session.status = { ...session.status, state: stopped ? "stopped" : "failed",
      phase: "", changed: run.changed, error: stopped ? (run.changed ? "중단했습니다. 저장된 변경은 되돌릴 수 있습니다." : "중단했습니다.")
        : reason instanceof Error ? reason.message : error instanceof Error ? error.message : "AI 실행에 실패했습니다." };
  } finally { clearTimeout(timeout); if (session.run === run) session.run = undefined; }
}
