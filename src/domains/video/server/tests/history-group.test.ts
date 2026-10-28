import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVideo, commitVideoEdit, historyVideo, readVideo, deleteVideo } from "../service";
test("video AI command edits preserve undo/redo and manual boundaries", () => {
  const previous = process.env.CONTENT_STUDIO_DB_PATH, directory = mkdtempSync(join(tmpdir(), "video-group-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  try {
    const job = createVideo();
    const edit = (color: string, group?: string) => commitVideoEdit(job.id, job.tabId, readVideo(job.id).revision,
      document => ({ ...document, backgroundColor: color }), group);
    edit("#111111", "a"); edit("#222222", "a");
    const undone = historyVideo(job.id, job.tabId, 2);
    assert.deepEqual(undone.document, job.document);
    const redone = historyVideo(job.id, job.tabId, undone.revision, true);
    assert.equal(redone.document.backgroundColor, "#222222");
    edit("#333333"); edit("#444444", "a");
    assert.equal(historyVideo(job.id, job.tabId, readVideo(job.id).revision).document.backgroundColor, "#333333");
    deleteVideo(job.id);
  } finally {
    if (previous === undefined) delete process.env.CONTENT_STUDIO_DB_PATH; else process.env.CONTENT_STUDIO_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
