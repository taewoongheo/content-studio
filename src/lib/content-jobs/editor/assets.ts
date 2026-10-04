import { AssetStore } from "@/lib/local-db/assets";
import { getLocalDatabase } from "@/lib/local-db/database";
import { imageTypes, MAX_UPLOAD_IMAGE_BYTES, validSignature } from "../http/upload";
import { ContentJobError, ContentJobRegistry } from "../workflow/registry";

function defaultStore() {
  return new AssetStore(getLocalDatabase());
}

export async function addEditorAsset(registry: ContentJobRegistry, jobId: string, file: File, store?: AssetStore) {
  const tabId = registry.getRecord(jobId).tabId;
  if (!(file.type in imageTypes) || file.size === 0 || file.size > MAX_UPLOAD_IMAGE_BYTES)
    throw new ContentJobError("INVALID_OUTPUT", "PNG, JPG, WebP 이미지를 10MB 이하로 추가해 주세요.");
  const type = file.type as keyof typeof imageTypes;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validSignature(type, bytes))
    throw new ContentJobError("INVALID_OUTPUT", "이미지 파일 형식을 확인해 주세요.");
  registry.requireTab(jobId, tabId);
  const asset = (store ?? defaultStore()).create({ name: file.name || `image${imageTypes[type]}`, type, bytes });
  registry.update(jobId, (current) => {
    current.assets.push({ id: asset.id, name: asset.name, type: asset.type, size: asset.size });
  });
  return registry.get(jobId);
}

export function attachStoredEditorAsset(registry: ContentJobRegistry, jobId: string, assetId: string, store?: AssetStore) {
  const job = registry.getRecord(jobId);
  const asset = (store ?? defaultStore()).get(assetId);
  if (!asset) throw new ContentJobError("JOB_NOT_FOUND", "저장된 이미지를 찾을 수 없습니다.");
  if (job.assets.some((item) => item.id === assetId)) return registry.get(jobId);
  return registry.update(jobId, (current) => {
    current.assets.push({ id: asset.id, name: asset.name, type: asset.type, size: asset.size });
  });
}

export async function readEditorAsset(registry: ContentJobRegistry, jobId: string, assetId: string, store?: AssetStore) {
  const asset = registry.getRecord(jobId).assets.find((item) => item.id === assetId);
  if (!asset) throw new ContentJobError("JOB_NOT_FOUND", "이미지를 찾을 수 없습니다.");
  const image = (store ?? defaultStore()).readImage(assetId);
  if (image) return image;
  throw new ContentJobError("JOB_NOT_FOUND", "이미지를 찾을 수 없습니다.");
}
