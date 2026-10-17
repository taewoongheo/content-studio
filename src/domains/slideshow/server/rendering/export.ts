import JSZip from "jszip";
import type { ContentJobSnapshot } from "@/domains/slideshow/domain/types";
import { writeExportFile } from "@/lib/media/export/file";
import { previewSlides } from "./preview";
import type { RenderContext } from "@/domains/workspace/server/jobs/manager";

export function exportSlideshow(origin: string, input: { job: ContentJobSnapshot; images: Record<string, string> }, outputPath: string, overwrite: boolean, context?: RenderContext) {
  return writeExportFile(outputPath, overwrite, async () => {
    const slides = await previewSlides(origin, input.job, input.job.editor.document.slides.map(slide => slide.id), {
      images: input.images, signal: context?.signal, progress: (progress, phase) => context?.progress(progress * 0.9, phase),
    });
    const zip = new JSZip();
    slides.forEach((slide, index) => zip.file(`slide-${String(index + 1).padStart(2, "0")}.png`, slide.bytes, { compression: "STORE" }));
    context?.signal.throwIfAborted(); context?.progress(0.95, "writing archive");
    return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  }, "zip", context?.signal);
}
