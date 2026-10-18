import type { ContentJobSnapshot } from "@/domains/slideshow/domain/types";
export type SlideshowReadOptions = { slideIds?: string[]; elementIds?: string[]; outline?: boolean; includeAssets?: boolean };
export function inspectSlideshow(job: ContentJobSnapshot, options: SlideshowReadOptions = {}) {
  const document = job.editor.document;
  for (const id of options.slideIds ?? []) if (!document.slides.some(slide => slide.id === id)) throw new Error(`슬라이드를 찾을 수 없습니다: ${id}`);
  for (const id of options.elementIds ?? []) if (!document.elements.some(element => element.id === id)) throw new Error(`Element를 찾을 수 없습니다: ${id}`);
  const selected = options.slideIds ? [...new Set(options.slideIds)].map(id => document.slides.find(slide => slide.id === id)!) : document.slides;
  const slides = selected.map(slide => ({ ...slide, placements: options.elementIds ? slide.placements.filter(placement => options.elementIds!.includes(placement.elementId)) : slide.placements }));
  const used = new Set(options.elementIds ?? slides.flatMap(slide => slide.placements.map(placement => placement.elementId)));
  const elements = document.elements.filter(element => used.has(element.id));
  if (options.outline) return {
    projectId: job.id, tabId: job.tabId, revision: job.editor.revision, savedRevision: job.savedRevision, name: job.name, aspectRatio: document.aspectRatio,
    slides: slides.map(slide => ({ id: slide.id, name: slide.name, role: slide.role, placements: slide.placements.map(placement => ({ id: placement.id, elementId: placement.elementId,
      kind: elements.find(element => element.id === placement.elementId)?.kind, name: elements.find(element => element.id === placement.elementId)?.name, value: placement.value })) })),
    ...(options.includeAssets !== false ? { assets: job.assets } : {}),
  };
  const partial = !!(options.slideIds || options.elementIds);
  const { assets, ...withoutAssets } = job;
  return { ...(options.includeAssets === false ? withoutAssets : { ...withoutAssets, assets }), ...(partial ? { partial: true } : {}),
    editor: { ...job.editor, document: partial ? { ...document, slides, elements } : document } };
}
export function summarizeSlideshow(job: ContentJobSnapshot) {
  return { projectId: job.id, tabId: job.tabId, revision: job.editor.revision, savedRevision: job.savedRevision, name: job.name,
    slides: job.editor.document.slides.map(slide => ({ id: slide.id, name: slide.name, placements: slide.placements.map(placement => ({ id: placement.id, elementId: placement.elementId })) })) };
}
