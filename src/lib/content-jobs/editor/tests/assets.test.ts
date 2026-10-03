import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AssetStore } from "@/lib/local-db/assets";
import { openLocalDatabase } from "@/lib/local-db/database";
import { addEditorAsset, attachStoredEditorAsset, readEditorAsset } from "../assets";
import { ContentJobRegistry } from "../../workflow/registry";

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("업로드한 이미지는 작업에 묶고 브라우저 상태에는 로컬 경로를 노출하지 않는다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "content-studio-asset-test-"));
  const database = openLocalDatabase(join(directory, "studio.sqlite"));
  const store = new AssetStore(database);
  try {
    const registry = new ContentJobRegistry({ createId: () => "job-1" });
    registry.add({
      model: "gpt-6-luna", structure: "repeating",
      productContext: { name: "앱", description: "설명", audience: "", constraints: "" },
      aspectRatio: "9:16", slideCount: 4, outputLanguage: "한국어",
      referenceImages: [{ id: "image-1", name: "ref.png", path: join(directory, "ref.png"), type: "image/png", size: 8, role: "hook" }],
    }, "thread-1");
    const snapshot = await addEditorAsset(registry, "job-1", new File([pngHeader], "new.png", { type: "image/png" }), store);
    const asset = snapshot.assets[0];
    assert.equal(asset.name, "new.png");
    assert.equal("path" in asset, false);
    const loaded = await readEditorAsset(registry, "job-1", asset.id, store);
    assert.deepEqual(new Uint8Array(loaded.bytes), pngHeader);
    assert.equal(store.get(asset.id)?.name, "new.png");
    const stored = store.create({ name: "기존 이미지", description: "운동 자세", type: "image/png", bytes: pngHeader });
    const beforeCount = store.list().length;
    const attached = attachStoredEditorAsset(registry, "job-1", stored.id, store);
    assert.equal(attached.assets.at(-1)?.id, stored.id);
    assert.deepEqual(new Uint8Array((await readEditorAsset(registry, "job-1", stored.id, store)).bytes), pngHeader);
    assert.equal(store.list().length, beforeCount);
    assert.equal(attachStoredEditorAsset(registry, "job-1", stored.id, store).assets.length, 2);
    assert.throws(() => attachStoredEditorAsset(registry, "job-1", "missing", store), /찾을 수 없습니다/);
    await assert.rejects(addEditorAsset(registry, "job-1", new File(["wrong"], "bad.png", { type: "image/png" }), store));
    const legacyPath = join(directory, "old.png");
    await writeFile(legacyPath, pngHeader);
    registry.update("job-1", (job) => {
      job.assets.push({ id: "old-id", name: "old.png", type: "image/png", size: pngHeader.length, path: legacyPath } as typeof job.assets[number]);
    });
    assert.deepEqual(new Uint8Array((await readEditorAsset(registry, "job-1", "old-id", store)).bytes), pngHeader);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
