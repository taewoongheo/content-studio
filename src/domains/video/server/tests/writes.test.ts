import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createVideo, readVideo, videoStore, historyVideo, closeVideo, deleteVideo, writeVideo } from "@/domains/video/server/service";
import { editVideoProject } from "@/domains/video/server/writes";
import type { LocalVideoMedia } from "@/domains/video/server/media/local";
const media: LocalVideoMedia = { bytes: Buffer.from("test media"), name: "exercise.mp4", type: "video/mp4", kind: "video", info: { duration: 1, width: 320, height: 240 } };
test("MCP 편집은 자산·문서·이력을 원자적으로 저장하고 비동기 읽기 뒤 revision을 재검사한다", async () => {
  const previous = process.env.CONTENT_STUDIO_DB_PATH, directory = mkdtempSync(join(tmpdir(), "video-mcp-test-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const project = createVideo(), first = randomUUID(), second = randomUUID();
  try {
    const saved = await editVideoProject(project.id, project.tabId, 0, [
      { type: "import_media", localPath: "/clip.mp4", layerId: first, mode: "sequence" },
      { type: "import_media", localPath: "/clip.mp4", layerId: second, mode: "sequence" },
      { type: "update_layer", layerId: second, changes: { cropX: 20, cropY: 80, volume: 0.25, opacity: 0.7, fit: "contain" } },
    ], async () => media);
    assert.equal(saved.revision, 1); assert.equal(saved.assets.length, 1);
    assert.deepEqual(saved.document.layers.map(layer => layer.from), [0, 30]);
    const before = readVideo(project.id);
    await assert.rejects(() => editVideoProject(project.id, project.tabId, 1, [
      { type: "import_media", localPath: "/other.mp4", mode: "overlay" },
      { type: "remove_layer", layerId: randomUUID() },
    ], async () => media), /commands\[1\]/);
    assert.deepEqual(readVideo(project.id), before);
    assert.equal(videoStore().assets(project.id).length, 1);
    const undone = historyVideo(project.id, project.tabId, 1);
    assert.equal(undone.document.layers.length, 0);
    const redone = historyVideo(project.id, project.tabId, undone.revision, true);
    assert.deepEqual(redone.document, saved.document);
    let ready!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => { ready = resolve; });
    const wait = new Promise<void>(resolve => { release = resolve; });
    const pending = editVideoProject(project.id, project.tabId, redone.revision, [{ type: "import_media", localPath: "/late.mp4", mode: "overlay" }], async () => { ready(); await wait; return media; });
    await started;
    const newer = writeVideo(project.id, project.tabId, redone.revision, { ...redone.document, backgroundColor: "#112233" });
    release(); await assert.rejects(pending, /다른 창/);
    assert.equal(videoStore().assets(project.id).length, 1);
    closeVideo(project.id, project.tabId, newer.revision);
    await assert.rejects(() => editVideoProject(project.id, project.tabId, newer.revision, [{ type: "remove_layer", layerId: first }]), /종료/);
  } finally {
    deleteVideo(project.id);
    if (previous === undefined) delete process.env.CONTENT_STUDIO_DB_PATH; else process.env.CONTENT_STUDIO_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
test("첫 미디어 편집 실패는 빈 임시 프로젝트의 DB 행과 자산도 남기지 않는다", async () => {
  const previous = process.env.CONTENT_STUDIO_DB_PATH, directory = mkdtempSync(join(tmpdir(), "video-mcp-empty-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const project = createVideo();
  try {
    await assert.rejects(() => editVideoProject(project.id, project.tabId, 0, [
      { type: "import_media", localPath: "/clip.mp4", mode: "sequence" },
      { type: "remove_layer", layerId: randomUUID() },
    ], async () => media));
    assert.equal(videoStore().get(project.id), null);
    assert.equal(videoStore().assets(project.id).length, 0);
    assert.equal(readVideo(project.id).revision, 0);
    assert.equal(readVideo(project.id).canUndo, false);
  } finally {
    deleteVideo(project.id);
    if (previous === undefined) delete process.env.CONTENT_STUDIO_DB_PATH; else process.env.CONTENT_STUDIO_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
