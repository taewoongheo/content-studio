import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import { getLocalDatabase } from "@/lib/local-db/database";
import { assistantStatus, authorizeAssistant, startAssistant, stopAssistant } from "../service";
import type { AssistantTarget } from "../../model";
import type { runCodex } from "@/lib/ai/codex";

async function finished(target: AssistantTarget) {
  for (let n = 0; n < 100; n++) {
    const status = assistantStatus(target);
    if (status.state !== "running") return status;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Assistant did not finish");
}

test("tab sessions isolate context, group real writes, require visual checks, and cancel on close", async () => {
  const directory = await mkdtemp(join(tmpdir(), "assistant-service-test-"));
  const previous = process.env.CONTENT_STUDIO_DB_PATH;
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const targets: AssistantTarget[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const job = contentJobRegistry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 1, outputLanguage: "English" });
      targets.push({ projectId: job.id, tabId: job.tabId, projectType: "slideshow" });
    }
    const calls: Array<{ tab: string; thread?: string }> = [];
    const fake: typeof runCodex = async input => {
      const target = targets.find(item => item.tabId === input.taskId)!;
      calls.push({ tab: target.tabId, thread: input.conversation?.threadId });
      input.onThreadStarted?.(target.tabId);
      const run = authorizeAssistant(target.tabId, `Bearer ${input.token}`);
      if (run.phase === "inspect") return { kind: "edit", text: "", suggestion: "" };
      const writer = new SlideshowProjectWrites(contentJobRegistry, getLocalDatabase(), undefined, run.id);
      for (const color of ["#111111", "#222222"]) {
        const job = contentJobRegistry.get(target.projectId);
        await writer.edit(job.id, [{ type: "set_slide_background", slideId: job.editor.document.slides[0].id, color }], job.editor.revision, job.tabId);
        run.changed = true;
      }
      const latest = contentJobRegistry.get(target.projectId);
      run.reviewedRevision = latest.editor.revision;
      run.slides.add(latest.editor.document.slides[0].id);
      return { kind: "edit", text: "", suggestion: "" };
    };
    const requestId = randomUUID();
    startAssistant(targets[0], {}, "배경 수정", requestId, "http://127.0.0.1:3000", fake);
    assert.equal(startAssistant(targets[0], {}, "배경 수정", requestId, "http://127.0.0.1:3000", fake).state, "running");
    assert.equal((await finished(targets[0])).state, "completed");
    assert.equal(contentJobRegistry.getRecord(targets[0].projectId).editorHistory.length, 1);
    assert.equal(contentJobRegistry.get(targets[1].projectId).editor.revision, 0);
    assert.deepEqual(calls.map(item => item.thread), [undefined, targets[0].tabId]);
    const answer: typeof runCodex = async input => {
      calls.push({ tab: input.taskId, thread: input.conversation?.threadId });
      return { kind: "answer", text: "제목이 잘 보입니다.", suggestion: "제목을 조금 줄여 줘" };
    };
    startAssistant(targets[0], {}, "제목 어떤가?", randomUUID(), "http://127.0.0.1:3000", answer);
    assert.equal((await finished(targets[0])).text, "제목이 잘 보입니다.");
    assert.equal(calls.at(-1)?.thread, targets[0].tabId);
    startAssistant(targets[1], {}, "제목 어떤가?", randomUUID(), "http://127.0.0.1:3000", answer);
    await finished(targets[1]); assert.equal(calls.at(-1)?.thread, undefined);
    assert.equal(contentJobRegistry.get(targets[0].projectId).editor.revision, 2);
    let signal: AbortSignal | undefined;
    const waiting: typeof runCodex = async input => {
      signal = input.signal;
      await new Promise<void>((_, reject) => input.signal.addEventListener("abort", () => reject(input.signal.reason), { once: true }));
      return {};
    };
    startAssistant(targets[1], {}, "이미지 조정", randomUUID(), "http://127.0.0.1:3000", waiting);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.throws(() => startAssistant(targets[1], {}, "다시", randomUUID(), "http://127.0.0.1:3000", waiting), /작업 중/);
    stopAssistant(targets[1].tabId);
    assert.ok(signal?.aborted); assert.equal((await finished(targets[1])).state, "stopped");
    await new Promise(resolve => setTimeout(resolve, 20));
    startAssistant(targets[1], {}, "이미지 조정", randomUUID(), "http://127.0.0.1:3000", waiting);
    await new Promise(resolve => setTimeout(resolve, 20));
    contentJobRegistry.remove(targets[1].projectId);
    assert.ok(signal?.aborted);
    assert.throws(() => authorizeAssistant(targets[1].tabId, "Bearer invalid"), /종료/);
  } finally {
    for (const target of targets) { try { contentJobRegistry.remove(target.projectId); } catch {} }
    if (previous === undefined) delete process.env.CONTENT_STUDIO_DB_PATH; else process.env.CONTENT_STUDIO_DB_PATH = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
