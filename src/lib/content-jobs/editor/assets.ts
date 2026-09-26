import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { imageTypes, MAX_REFERENCE_IMAGE_BYTES, validSignature } from "../http/upload";
import { ContentJobError, ContentJobRegistry } from "../workflow/registry";

export async function addEditorAsset(registry: ContentJobRegistry, jobId: string, file: File) {
  const job = registry.getRecord(jobId);
  if (job.activeOperation)
    throw new ContentJobError("OPERATION_IN_PROGRESS", "AI 작업이 끝난 뒤 이미지를 추가해 주세요.");
  if (!(file.type in imageTypes) || file.size === 0 || file.size > MAX_REFERENCE_IMAGE_BYTES)
    throw new ContentJobError("INVALID_OUTPUT", "PNG, JPG, WebP 이미지를 10MB 이하로 추가해 주세요.");
  const type = file.type as keyof typeof imageTypes;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validSignature(type, bytes))
    throw new ContentJobError("INVALID_OUTPUT", "이미지 파일 형식을 확인해 주세요.");
  const id = randomUUID();
  const path = join(dirname(job.referenceImages[0].path), `asset-${id}${imageTypes[type]}`);
  await writeFile(path, bytes, { flag: "wx" });
  registry.update(jobId, (current) => {
    current.assets.push({ id, name: file.name || `image${imageTypes[type]}`, path, type, size: file.size });
  });
  return registry.get(jobId);
}

export async function readEditorAsset(registry: ContentJobRegistry, jobId: string, assetId: string) {
  const asset = registry.getRecord(jobId).assets.find((item) => item.id === assetId);
  if (!asset) throw new ContentJobError("JOB_NOT_FOUND", "이미지를 찾을 수 없습니다.");
  return { bytes: await readFile(asset.path), type: asset.type };
}
