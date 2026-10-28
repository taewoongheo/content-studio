import sharp from "sharp";
import { readSourceImage } from "@/domains/research/media/images";
import type { VisualSlide } from "../../publication/visuals";

// Persona OCR needs readable body text; archived 540px previews are insufficient.
export async function capturePersonaSlides(urls: string[]): Promise<VisualSlide[]> {
  const slides: VisualSlide[] = [];
  for (const url of urls) {
    const source = await readSourceImage(url);
    const { data, info } = await sharp(Buffer.from(source.data, "base64"))
      .resize({ width: 1600, withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    slides.push({ data, width: info.width, height: info.height });
  }
  return slides;
}
