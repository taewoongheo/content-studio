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
