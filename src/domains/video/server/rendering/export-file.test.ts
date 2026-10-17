import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeVideoExport } from "@/domains/video/server/rendering/export-file";

test("내보내기는 렌더링 전에 출력 경로를 예약하고 실패 시 빈 파일을 정리한다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "video-export-test-")), output = join(dir, "export.mp4");
  try {
    await assert.rejects(writeVideoExport(output, false, async () => {
      await access(output);
      await assert.rejects(writeVideoExport(output, false, async () => { throw new Error("must not render"); }), /이미/);
      throw new Error("render failed");
    }), /render failed/);
    assert.deepEqual(await readdir(dir), []);
    let rendered = false;
    await assert.rejects(writeVideoExport(join(dir, "missing", "export.mp4"), false, async () => { rendered = true; return Buffer.from("bad"); }));
    assert.equal(rendered, false);
    assert.equal(await writeVideoExport(output, false, async () => Buffer.from("complete video")), 14);
    assert.equal(await readFile(output, "utf8"), "complete video");
    assert.deepEqual(await readdir(dir), ["export.mp4"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("덮어쓰기 렌더 실패는 기존 파일을 보존하고 성공할 때만 교체한다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "video-export-overwrite-")), output = join(dir, "export.mp4");
  try {
    await writeFile(output, "original");
    await assert.rejects(writeVideoExport(output, true, async () => { throw new Error("failed"); }));
    assert.equal(await readFile(output, "utf8"), "original");
    await writeVideoExport(output, true, async () => Buffer.from("new video"));
    assert.equal(await readFile(output, "utf8"), "new video");
    assert.deepEqual(await readdir(dir), ["export.mp4"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
