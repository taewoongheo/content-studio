import { readFile } from "node:fs/promises";
import { AssetStore } from "@/lib/local-db/assets";
import { getLocalDatabase } from "@/lib/local-db/database";
import { imageTypes, MAX_REFERENCE_IMAGE_BYTES, validSignature } from "../http/upload";
import { ContentJobError, ContentJobRegistry } from "../workflow/registry";

function defaultStore() {
  return new AssetStore(getLocalDatabase());
}

export async function addEditorAsset(registry: ContentJobRegistry, jobId: string, file: File, store?: AssetStore) {
  const job = registry.getRecord(jobId);
  if (job.activeOperation)
    throw new ContentJobError("OPERATION_IN_PROGRESS", "AI 작업이 끝난 뒤 이미지를 추가해 주세요.");
  if (!(file.type in imageTypes) || file.size === 0 || file.size > MAX_REFERENCE_IMAGE_BYTES)
    throw new ContentJobError("INVALID_OUTPUT", "PNG, JPG, WebP 이미지를 10MB 이하로 추가해 주세요.");
  const type = file.type as keyof typeof imageTypes;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validSignature(type, bytes))
    throw new ContentJobError("INVALID_OUTPUT", "이미지 파일 형식을 확인해 주세요.");
  const asset = (store ?? defaultStore()).create({ name: file.name || `image${imageTypes[type]}`, type, bytes });
  registry.update(jobId, (current) => {
    current.assets.push({ id: asset.id, name: asset.name, type: asset.type, size: asset.size });
  });
  return registry.get(jobId);
}

export async function readEditorAsset(registry: ContentJobRegistry, jobId: string, assetId: string, store?: AssetStore) {
  const asset = registry.getRecord(jobId).assets.find((item) => item.id === assetId);
  if (!asset) throw new ContentJobError("JOB_NOT_FOUND", "이미지를 찾을 수 없습니다.");
  const image = (store ?? defaultStore()).readImage(assetId);
  if (image) return image;
  // Jobs retained through development reloads may still point to pre-SQLite temporary files.
  const legacyPath = (asset as typeof asset & { path?: string }).path;
  if (legacyPath) return { bytes: await readFile(legacyPath), type: asset.type };
  throw new ContentJobError("JOB_NOT_FOUND", "이미지를 찾을 수 없습니다.");
}
