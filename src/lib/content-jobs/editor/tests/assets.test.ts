import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { addEditorAsset, readEditorAsset } from "../assets";
import { ContentJobRegistry } from "../../workflow/registry";

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("업로드한 이미지는 작업에 묶고 브라우저 상태에는 로컬 경로를 노출하지 않는다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "content-studio-asset-test-"));
  try {
    const registry = new ContentJobRegistry({ createId: () => "job-1" });
    registry.add({
      model: "gpt-6-luna", structure: "repeating",
      productContext: { name: "앱", description: "설명", audience: "", constraints: "" },
      aspectRatio: "9:16", slideCount: 4, outputLanguage: "한국어",
      referenceImages: [{ id: "image-1", name: "ref.png", path: join(directory, "ref.png"), type: "image/png", size: 8, role: "hook" }],
    }, "thread-1");
    const snapshot = await addEditorAsset(registry, "job-1", new File([pngHeader], "new.png", { type: "image/png" }));
    const asset = snapshot.assets[0];
    assert.equal(asset.name, "new.png");
    assert.equal("path" in asset, false);
    const loaded = await readEditorAsset(registry, "job-1", asset.id);
    assert.deepEqual(new Uint8Array(loaded.bytes), pngHeader);
    await assert.rejects(addEditorAsset(registry, "job-1", new File(["wrong"], "bad.png", { type: "image/png" })));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
