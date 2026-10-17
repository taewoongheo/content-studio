import type { ContentJobSnapshot } from "@/domains/slideshow/domain/types";
import { previewSlides } from "./rendering/preview";
export { previewSlides } from "./rendering/preview";
export async function previewSlide(origin: string, job: ContentJobSnapshot, slideId: string) {
  return (await previewSlides(origin, job, [slideId]))[0].bytes.toString("base64");
}
