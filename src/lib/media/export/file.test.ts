import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeExportFile } from "./file";
test("취소된 ZIP 내보내기는 기존 파일을 보존하고 임시 파일을 정리한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "studio-export-cancel-"));
  try {
    const output = join(directory, "slides.zip"); await writeFile(output, "original");
    const controller = new AbortController();
    await assert.rejects(writeExportFile(output, true, async () => { controller.abort(new Error("cancelled")); return Buffer.from("new"); }, "zip", controller.signal), /cancelled/);
    assert.equal(await readFile(output, "utf8"), "original"); assert.deepEqual(await readdir(directory), ["slides.zip"]);
    await assert.rejects(writeExportFile(join(directory, "wrong.mp4"), false, async () => Buffer.from(""), "zip"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
