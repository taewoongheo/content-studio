import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { executeWithStageRecovery } from "./stage-recovery";
import { OperationError } from "@/lib/errors/operation";
import type { runCodex } from "../../process";
const input = { prompt: "Produce", schema: {}, origin: "server", taskId: "task", token: "secret", signal: new AbortController().signal,
  capabilities: { webSearch: true, shell: true, imageGeneration: true }, onActivity() {} };
const valid = { review: "Repaired", review_passed: true, project_id: "p", summary: {}, sources: [] };
test("completion failure resumes the same CLI with editing tools and preserves its project", async () => {
  const calls: Parameters<typeof runCodex>[0][] = []; let validations = 0;
  await executeWithStageRecovery(async request => {
    calls.push(request);
    await access(request.conversation!.directory);
    if (calls.length === 1) request.onThreadStarted!("same-thread");
    else { assert.equal(request.conversation?.threadId, "same-thread"); assert.match(request.prompt, /EMPTY_SLIDE/); }
    assert.equal(request.token, input.token); assert.deepEqual(request.capabilities, input.capabilities);
    return valid;
  }, input, "hook", async () => { if (++validations === 1) throw new OperationError("EMPTY_SLIDE", "Fill slide", {slide_ids:["s"]}); });
  assert.equal(calls.length, 2); assert.equal(calls[0].conversation?.threadId, undefined);
  await assert.rejects(access(calls[0].conversation!.directory));
});
test("schema errors and rejected reviews repair actual work rather than manufacturing approval", async () => {
  let calls = 0;
  await executeWithStageRecovery(async request => {
    request.onThreadStarted!("review-thread");
    if (++calls === 1) throw new OperationError("CLI_OUTPUT_INVALID_JSON", "Invalid", {output:"unfinished"});
    if (calls === 2) { assert.match(request.prompt, /unfinished/); return {...valid, review_passed:false}; }
    assert.match(request.prompt, /REVIEW_REJECTED/); return valid;
  }, input, "hook", async result => { if (!result.review_passed) throw new OperationError("REVIEW_REJECTED", "Repair the clipping"); });
  assert.equal(calls, 3);
});
test("service, database and cancellation failures stop without a replay", async () => {
  for (const error of [new OperationError("CLI_PROCESS_FAILED", "API offline"), new Error("SQLITE_IOERR")]) {
    let calls = 0;
    await assert.rejects(executeWithStageRecovery(async () => {calls++; throw error;}, input, "hook", async () => {}), e => e === error);
    assert.equal(calls, 1);
  }
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(executeWithStageRecovery(async () => { calls++; controller.abort(); return valid; }, {...input,signal:controller.signal}, "hook", async () => {}));
  assert.equal(calls, 1);
});
test("recovery is bounded and retains the final actionable error", async () => {
  let calls = 0;
  await assert.rejects(executeWithStageRecovery(async () => {calls++; return valid;}, input, "hook", async () => {
    throw new OperationError("EMPTY_SLIDE", "Still blank", {slide_ids:["s"]});
  }), e => { assert.ok(e instanceof OperationError); assert.equal(e.code,"EMPTY_SLIDE"); assert.equal(e.details.recovery_attempts,5); return true; });
  assert.equal(calls, 6);
});
