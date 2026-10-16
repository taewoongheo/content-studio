import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLayer } from "../../domain/model";
import { createVideo, writeVideo, closeVideo, openVideo, videoStore, historyVideo, deleteVideo, videoTabs } from "../service";
test("빈 영상은 저장하지 않고 최초 편집부터 저장하며 stale revision·stale 탭은 초안을 덮어쓰지 않는다", () => {
  const original = process.env.CONTENT_STUDIO_DB_PATH, dir = mkdtempSync(join(tmpdir(), "video-session-test-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(dir, "test.sqlite");
  try {
    const s = createVideo(); assert.equal(videoStore().list().length, 0);
    const doc = { ...s.document, layers: [createLayer("text", s.document)] };
    const saved = writeVideo(s.id, s.tabId, 0, doc);
    assert.equal(videoStore().get(s.id)?.revision, 1);
    assert.throws(() => writeVideo(s.id, s.tabId, 0, s.document), /다른 창/);
    assert.throws(() => closeVideo(s.id, s.tabId, 0), /다른 창/);
    assert.equal(videoStore().get(s.id)?.document.layers.length, 1);
    const undone = historyVideo(s.id, s.tabId, saved.revision); assert.equal(undone.document.layers.length, 0);
    const redone = historyVideo(s.id, s.tabId, undone.revision, true); assert.equal(redone.document.layers.length, 1);
    closeVideo(s.id, s.tabId, redone.revision);
    const reopened = openVideo(s.id); assert.notEqual(reopened.tabId, s.tabId); assert.deepEqual(reopened.document, saved.document);
    assert.throws(() => writeVideo(s.id, s.tabId, reopened.revision, doc), /종료/);
    deleteVideo(s.id); assert.equal(videoTabs().length, 0);
  } finally { if (original === undefined) delete process.env.CONTENT_STUDIO_DB_PATH; else process.env.CONTENT_STUDIO_DB_PATH = original; rmSync(dir, { recursive: true, force: true }); }
});
