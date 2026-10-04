import { randomUUID } from "node:crypto";
import type { EditorAsset } from "../domain/types";
import { imageTypes, MAX_UPLOAD_IMAGE_BYTES, validSignature } from "../http/upload";
import { ContentJobError, ContentJobRegistry } from "../workflow/registry";

export type EditorImage = EditorAsset & { bytes: Uint8Array };

export function createEditorImage(input: { name: string; type: EditorAsset["type"]; bytes: Uint8Array }): EditorImage {
  return { id: randomUUID(), name: input.name, type: input.type, size: input.bytes.byteLength,
    bytes: new Uint8Array(input.bytes) };
}

export async function addEditorAsset(registry: ContentJobRegistry, jobId: string, file: File) {
  const tabId = registry.getRecord(jobId).tabId;
  if (!(file.type in imageTypes) || file.size === 0 || file.size > MAX_UPLOAD_IMAGE_BYTES)
    throw new ContentJobError("INVALID_OUTPUT", "PNG, JPG, WebP 이미지를 10MB 이하로 추가해 주세요.");
  const type = file.type as keyof typeof imageTypes;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validSignature(type, bytes))
    throw new ContentJobError("INVALID_OUTPUT", "이미지 파일 형식을 확인해 주세요.");
  registry.requireTab(jobId, tabId);
  const { bytes: data, ...asset } = createEditorImage({ name: file.name || `image${imageTypes[type]}`, type, bytes });
  return registry.update(jobId, (current) => {
    current.assets.push(asset);
    current.imageData[asset.id] = data;
  });
}

export async function readEditorAsset(registry: ContentJobRegistry, jobId: string, assetId: string) {
  const job = registry.getRecord(jobId);
  const asset = job.assets.find((item) => item.id === assetId);
  const data = job.imageData[assetId];
  if (!asset || !data) throw new ContentJobError("JOB_NOT_FOUND", "이미지를 찾을 수 없습니다.");
  return { bytes: Buffer.from(data), type: asset.type };
}
