import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContentJobRecord } from "../../../domain/types";
import { imageTypes, MAX_REFERENCE_IMAGE_BYTES, validSignature } from "../../../http/upload";
import { ContentJobError } from "../../../workflow/registry";
import { MAX_CHAT_IMAGES } from "@/lib/image-upload";

export type ChatImage = NonNullable<ContentJobRecord["chatImages"]>[number];

export async function saveChatImages(job: ContentJobRecord, files: File[]): Promise<ChatImage[]> {
  if (files.length > MAX_CHAT_IMAGES)
    throw new ContentJobError("INVALID_OUTPUT", `이미지는 최대 ${MAX_CHAT_IMAGES}장까지 첨부할 수 있습니다.`);
  if (files.length === 0) return [];
  const prepared = await Promise.all(files.map(async (file) => {
    if (!(file.type in imageTypes) || file.size === 0 || file.size > MAX_REFERENCE_IMAGE_BYTES)
      throw new ContentJobError("INVALID_OUTPUT", "PNG, JPG, WebP 이미지를 10MB 이하로 첨부해 주세요.");
    const type = file.type as keyof typeof imageTypes;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validSignature(type, bytes))
      throw new ContentJobError("INVALID_OUTPUT", "이미지 파일 형식을 확인해 주세요.");
    const id = randomUUID();
    return { id, name: file.name || `image${imageTypes[type]}`, type, bytes };
  }));
  const directory = await mkdtemp(join(tmpdir(), "content-studio-chat-"));
  const images: ChatImage[] = [];
  try {
    for (const item of prepared) {
      const path = join(/* turbopackIgnore: true */ directory, `${item.id}${imageTypes[item.type]}`);
      await writeFile(path, item.bytes, { flag: "wx" });
      images.push({ id: item.id, name: item.name, type: item.type, path });
    }
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  (job.chatImages ??= []).push(...images);
  return images;
}

export async function readChatImage(job: ContentJobRecord, imageId: string) {
  const image = job.chatImages?.find((item) => item.id === imageId);
  if (!image) throw new ContentJobError("JOB_NOT_FOUND", "채팅 이미지를 찾을 수 없습니다.");
  return { type: image.type, bytes: await readFile(image.path) };
}
