import assert from "node:assert/strict";
import test from "node:test";
import { addEditorAsset, readEditorAsset } from "../assets";
import { ContentJobRegistry } from "../../workflow/registry";

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("업로드한 이미지는 작업 안에 보관하고 다른 작업과 브라우저 JSON에 바이트를 노출하지 않는다", async () => {
  const registry = new ContentJobRegistry();
  const input = { structure: "sequential" as const, aspectRatio: "4:5" as const, slideCount: 2, outputLanguage: "English" };
  const job = registry.add(input);
  const other = registry.add(input);
  const snapshot = await addEditorAsset(registry, job.id, new File([pngHeader], "new.png", { type: "image/png" }));
  const asset = snapshot.assets[0];
  assert.equal(asset.name, "new.png");
  assert.equal("bytes" in asset, false);
  assert.equal("imageData" in snapshot, false);
  assert.deepEqual(new Uint8Array((await readEditorAsset(registry, job.id, asset.id)).bytes), pngHeader);
  await assert.rejects(readEditorAsset(registry, other.id, asset.id), /찾을 수 없습니다/);
  await assert.rejects(addEditorAsset(registry, job.id, new File(["wrong"], "bad.png", { type: "image/png" })));
  assert.equal(registry.get(job.id).assets.length, 1);
  registry.remove(job.id);
  await assert.rejects(readEditorAsset(registry, job.id, asset.id), /찾을 수 없습니다/);
});
