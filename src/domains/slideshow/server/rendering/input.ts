import type { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
export function captureSlideshowRender(registry: ContentJobRegistry, projectId: string) {
  const job = registry.get(projectId), record = registry.getRecord(projectId);
  const images = Object.fromEntries(job.assets.filter(asset => record.imageData[asset.id]).map(asset =>
    [asset.id, `data:${asset.type};base64,${Buffer.from(record.imageData[asset.id]).toString("base64")}`]));
  return { job, images };
}
