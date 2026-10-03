import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ContentJobRecord } from "../../../domain/types";
import { imageTypes, MAX_REFERENCE_IMAGE_BYTES, validSignature } from "../../../http/upload";
import { ContentJobError } from "../../../workflow/registry";
import { MAX_CHAT_IMAGES } from "@/lib/image-upload";

export type ChatImage = NonNullable<ContentJobRecord["chatImages"]>[number];

export async function saveChatImages(job: ContentJobRecord, files: File[]): Promise<ChatImage[]> {
  if (files.length > MAX_CHAT_IMAGES)
    throw new ContentJobError("INVALID_OUTPUT", `이미지는 최대 ${MAX_CHAT_IMAGES}장까지 첨부할 수 있습니다.`);
  const prepared = await Promise.all(files.map(async (file) => {
    if (!(file.type in imageTypes) || file.size === 0 || file.size > MAX_REFERENCE_IMAGE_BYTES)
      throw new ContentJobError("INVALID_OUTPUT", "PNG, JPG, WebP 이미지를 10MB 이하로 첨부해 주세요.");
    const type = file.type as keyof typeof imageTypes;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validSignature(type, bytes))
      throw new ContentJobError("INVALID_OUTPUT", "이미지 파일 형식을 확인해 주세요.");
    const id = randomUUID();
    const path = join(dirname(job.referenceImages[0].path), `chat-${id}${imageTypes[type]}`);
    return { image: { id, name: file.name || `image${imageTypes[type]}`, type, path }, bytes };
  }));
  const written: string[] = [];
  try {
    for (const item of prepared) {
      await writeFile(item.image.path, item.bytes, { flag: "wx" });
      written.push(item.image.path);
    }
  } catch (error) {
    await Promise.all(written.map((path) => unlink(path)));
    throw error;
  }
  const images = prepared.map((item) => item.image);
  (job.chatImages ??= []).push(...images);
  return images;
}

export async function readChatImage(job: ContentJobRecord, imageId: string) {
  const image = job.chatImages?.find((item) => item.id === imageId);
  if (!image) throw new ContentJobError("JOB_NOT_FOUND", "채팅 이미지를 찾을 수 없습니다.");
  return { type: image.type, bytes: await readFile(image.path) };
}
