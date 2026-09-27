import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ContentJobRecord } from "../../../domain/types";
import { imageTypes, MAX_REFERENCE_IMAGE_BYTES, validSignature } from "../../../http/upload";
import { ContentJobError } from "../../../workflow/registry";

export type ChatImage = NonNullable<ContentJobRecord["chatImages"]>[number];

export async function saveChatImage(job: ContentJobRecord, file: File): Promise<ChatImage> {
  if (!(file.type in imageTypes) || file.size === 0 || file.size > MAX_REFERENCE_IMAGE_BYTES)
    throw new ContentJobError("INVALID_OUTPUT", "PNG, JPG, WebP 이미지를 10MB 이하로 첨부해 주세요.");
  const type = file.type as keyof typeof imageTypes;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validSignature(type, bytes))
    throw new ContentJobError("INVALID_OUTPUT", "이미지 파일 형식을 확인해 주세요.");
  const id = randomUUID();
  const path = join(dirname(job.referenceImages[0].path), `chat-${id}${imageTypes[type]}`);
  await writeFile(path, bytes, { flag: "wx" });
  const image = { id, name: file.name || `image${imageTypes[type]}`, type, path };
  (job.chatImages ??= []).push(image);
  return image;
}

export async function readChatImage(job: ContentJobRecord, imageId: string) {
  const image = job.chatImages?.find((item) => item.id === imageId);
  if (!image) throw new ContentJobError("JOB_NOT_FOUND", "채팅 이미지를 찾을 수 없습니다.");
  return { type: image.type, bytes: await readFile(image.path) };
}
