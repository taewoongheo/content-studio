import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, access, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("서버 프로세스 종료 시 유휴 렌더 번들과 작업 폴더를 정리한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "studio-render-exit-test-"));
  try {
    const worker = join(directory, "exit.mts");
    await writeFile(worker, `import { renderTemporaryDirectory } from ${JSON.stringify(resolve("src/lib/media/rendering/temp/directories.ts"))};\nconsole.log(await renderTemporaryDirectory("studio-exit-bundle-"));`);
    const { stdout } = await promisify(execFile)(process.execPath, ["--import", "tsx", worker]);
    await assert.rejects(access(stdout.trim()), /ENOENT/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
