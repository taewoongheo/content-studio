import assert from "node:assert/strict";
import test from "node:test";
import { rm } from "node:fs/promises";
import { dirname, basename } from "node:path";
import { ContentJobRegistry } from "../../../workflow/registry";
import { readChatImage, saveChatImages } from "./chat-images";

test("레퍼런스 없는 불러온 프로젝트에도 채팅 이미지 10장을 독립적으로 저장한다", async () => {
  const registry = new ContentJobRegistry({ createId: () => "restored-project" });
  registry.add({ model: "gpt-6-luna", structure: "sequential", aspectRatio: "4:5", slideCount: 2,
    outputLanguage: "English", referenceImages: [],
    productContext: { name: "", description: "", audience: "", constraints: "" } }, "thread");
  const job = registry.getRecord("restored-project");
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const files = Array.from({ length: 10 }, (_, index) => new File([bytes], `${index}.png`, { type: "image/png" }));
  const images = await saveChatImages(job, files);
  try {
    assert.equal(images.length, 10);
    assert.ok(basename(dirname(images[0].path)).startsWith("content-studio-chat-"));
    assert.deepEqual(job.referenceImages, []);
    for (const image of images) assert.deepEqual(new Uint8Array((await readChatImage(job, image.id)).bytes), bytes);
    await assert.rejects(saveChatImages(job, [new File(["not png"], "bad.png", { type: "image/png" })]));
    assert.equal(job.chatImages?.length, 10);
    assert.deepEqual(await saveChatImages(job, []), []);
  } finally { await rm(dirname(images[0].path), { recursive: true, force: true }); }
});
