import assert from "node:assert/strict";
import test from "node:test";
import { MAX_UPLOAD_IMAGE_BYTES, selectChatUploadImages, selectUploadImage } from "./image-upload";

test("단일 이미지 선택과 드롭에 같은 검증을 적용한다", () => {
  const image = new File(["image"], "character.png", { type: "image/png" });
  assert.equal(selectUploadImage([image]).file, image);
  assert.match(selectUploadImage([]).error ?? "", /한 장/);
  assert.match(selectUploadImage([image, image]).error ?? "", /한 장/);
  assert.match(selectUploadImage([new File(["text"], "note.txt", { type: "text/plain" })]).error ?? "", /PNG/);
  assert.match(selectUploadImage([new File([new Uint8Array(MAX_UPLOAD_IMAGE_BYTES + 1)], "large.png", { type: "image/png" })]).error ?? "", /10MB/);
});

test("채팅 이미지는 여러 장을 누적하고 초과·잘못된 파일은 전체 선택을 거부한다", () => {
  const image = new File(["image"], "character.png", { type: "image/png" });
  assert.deepEqual(selectChatUploadImages([image], [image, image]).files, [image, image, image]);
  assert.equal(selectChatUploadImages([], Array(10).fill(image)).files?.length, 10);
  assert.match(selectChatUploadImages(Array(8).fill(image), Array(3).fill(image)).error ?? "", /최대 10장/);
  assert.match(selectChatUploadImages([image], [image, new File(["text"], "note.txt", { type: "text/plain" })]).error ?? "", /PNG/);
});
