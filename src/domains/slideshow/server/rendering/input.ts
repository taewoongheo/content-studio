import { createHash } from "node:crypto";
import type { ContentJobSnapshot } from "../../domain/types";
import type { EditorDocument } from "../../editor/types";
import type { ContentProjectStore } from "../persistence/projects/store";
import type { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
export function captureSlideshowRender(registry: ContentJobRegistry, projectId: string, slideIds?: string[]) {
  const job = registry.get(projectId), record = registry.getRecord(projectId);
  const imageElements = new Set(job.editor.document.elements.filter(element => element.kind === "image").map(element => element.id));
  const used = new Set(job.editor.document.slides.filter(slide => !slideIds || slideIds.includes(slide.id))
    .flatMap(slide => slide.placements.filter(placement => imageElements.has(placement.elementId) && placement.value).map(placement => placement.value)));
  // Asset bytes are immutable; retain their references for snapshot consistency, encode only on a cache miss.
  const pinned = job.assets.filter(asset => used.has(asset.id)).map(asset => {
    const bytes = record.imageData[asset.id]; if (!bytes) throw new Error("이미지 바이트를 찾을 수 없습니다.");
    return { ...asset, bytes };
  });
  let encoded: Record<string, string> | undefined;
  return { job, images: () => encoded ??= Object.fromEntries(pinned.map(asset =>
    [asset.id, `data:${asset.type};base64,${Buffer.from(asset.bytes).toString("base64")}`])) };
}

/** Render a persisted document without registering an editor tab or changing its draft. */
export function captureSavedSlideshowRender(store: ContentProjectStore, projectId: string, slideIds?: string[]) {
  const project = store.get(projectId);
  if (!project) throw new Error("저장된 프로젝트를 찾을 수 없습니다.");
  const document = project.document as EditorDocument;
  for (const id of slideIds ?? [])
    if (!document.slides.some(slide => slide.id === id)) throw new Error("슬라이드를 찾을 수 없습니다: " + id);
  const imageElements = new Set(document.elements.filter(element => element.kind === "image").map(element => element.id));
  const used = new Set(document.slides.filter(slide => !slideIds || slideIds.includes(slide.id))
    .flatMap(slide => slide.placements.filter(placement => imageElements.has(placement.elementId) && placement.value).map(placement => placement.value)));
  const assets = project.assets.filter(asset => used.has(asset.assetId));
  for (const id of used) if (!assets.some(asset => asset.assetId === id)) throw new Error("저장된 이미지를 찾을 수 없습니다: " + id);
  const hash = createHash("sha256").update(JSON.stringify(document));
  for (const asset of assets) hash.update(asset.assetId).update(asset.bytes);
  const job: ContentJobSnapshot = {
    id: project.id, tabId: "saved:" + hash.digest("hex"), name: project.name,
    structure: document.structure, aspectRatio: document.aspectRatio, slideCount: document.slides.length,
    outputLanguage: project.outputLanguage, editor: { revision: 0, document },
    assets: project.assets.map(asset => ({ id: asset.assetId, name: asset.name, type: asset.type, size: asset.bytes.length })),
    createdAt: project.createdAt, updatedAt: project.updatedAt,
  };
  let encoded: Record<string,string> | undefined;
  return { job, images: () => encoded ??= Object.fromEntries(assets.map(asset =>
    [asset.assetId, "data:" + asset.type + ";base64," + asset.bytes.toString("base64")])) };
}
