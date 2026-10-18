import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRenderProcess } from "./process";
test("실행 중 렌더 프로세스 취소는 종료를 기다리고 다음 프로세스 실행을 막지 않는다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "studio-render-process-"));
  try {
    const worker = join(directory, "worker.mts");
    await writeFile(worker, 'process.send?.({progress: 0.5, phase: "rendering"}); setInterval(() => {}, 100);');
    const controller = new AbortController(); let progress = false;
    const result = runRenderProcess(worker, [], { signal: controller.signal, progress: () => { progress = true; controller.abort(new Error("cancel render")); } });
    await assert.rejects(result, /cancel render/); assert.equal(progress, true);
    await writeFile(worker, 'process.send?.({progress: 1, phase: "done"});');
    await runRenderProcess(worker, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
