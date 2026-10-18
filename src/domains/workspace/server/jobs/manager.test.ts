import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { RenderJobs } from "./manager";
const input = { projectId: "project", projectType: "video" as const, revision: 3 };

test("렌더 작업은 요청과 독립적으로 완료되고 실패·취소 뒤에도 다음 작업을 처리한다", async () => {
  const jobs = new RenderJobs();
  const first = jobs.start(input, async ({ progress }) => { progress(0.5, "rendering"); return { outputPath: "/tmp/test.mp4", bytes: 8 }; });
  assert.equal(first.status, "queued"); assert.equal(first.revision, 3);
  await setImmediate(); assert.equal(jobs.get(first.jobId).status, "completed");
  const failed = jobs.start(input, async () => { throw new Error("bad source"); });
  await setImmediate(); assert.equal(jobs.get(failed.jobId).error, "bad source");
  let ran = false;
  const queued = jobs.start(input, async () => { ran = true; return { outputPath: "", bytes: 0 }; });
  jobs.cancel(queued.jobId); await setImmediate();
  assert.equal(jobs.get(queued.jobId).status, "cancelled"); assert.equal(ran, false);
  const running = jobs.start(input, ({ signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })));
  await setImmediate(); assert.equal(jobs.cancel(running.jobId).status, "cancelling");
  await setImmediate(); assert.equal(jobs.get(running.jobId).status, "cancelled");
  assert.equal(jobs.cancel(first.jobId).status, "completed");
});
test("작업 조회는 사본을 반환하고 완료 기록은 제한하며 늦은 취소는 완료 파일을 숨기지 않는다", async () => {
  const jobs = new RenderJobs(60_000, 1);
  const first = jobs.start(input, async () => ({ outputPath: "/tmp/one", bytes: 1 }));
  await setImmediate(); const copy = jobs.get(first.jobId); copy.status = "failed";
  assert.equal(jobs.get(first.jobId).status, "completed");
  const second = jobs.start(input, async () => ({ outputPath: "/tmp/two", bytes: 2 }));
  await setImmediate(); assert.throws(() => jobs.get(first.jobId));
  assert.equal(jobs.get(second.jobId).status, "completed");
});
