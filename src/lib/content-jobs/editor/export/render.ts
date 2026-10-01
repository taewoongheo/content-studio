import sharp from "sharp";
import type {
  EditorDocument,
  EditorSlide,
  ElementDefinition,
  ElementFrame,
  ElementStyle,
} from "../types";
import { BACKGROUND_ELEMENT_ID } from "../document";

export type ExportDimensions = { width: number; height: number };
export type ReadExportAsset = (assetId: string) => Promise<{ bytes: Uint8Array | Buffer; type: string }>;

const dimensionsByAspectRatio: Record<EditorDocument["aspectRatio"], ExportDimensions> = {
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
};

function escapeMarkup(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function pixelFrame(frame: ElementFrame, dimensions: ExportDimensions) {
  return {
    x: Math.round(frame.x * dimensions.width),
    y: Math.round(frame.y * dimensions.height),
    width: Math.max(1, Math.round(frame.width * dimensions.width)),
    height: Math.max(1, Math.round(frame.height * dimensions.height)),
  };
}

function visibleRegion(frame: ReturnType<typeof pixelFrame>, dimensions: ExportDimensions) {
  const left = Math.max(0, frame.x);
  const top = Math.max(0, frame.y);
  const right = Math.min(dimensions.width, frame.x + frame.width);
  const bottom = Math.min(dimensions.height, frame.y + frame.height);
  if (right <= left || bottom <= top) return null;
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    sourceLeft: left - frame.x,
    sourceTop: top - frame.y,
  };
}

function transparentOrColor(color: string) {
  return color === "transparent" ? { r: 0, g: 0, b: 0, alpha: 0 } : color;
}

async function renderText(width: number, height: number, value: string, style: ElementStyle) {
  const background = transparentOrColor(style.backgroundColor);
  const base = sharp({ create: { width, height, channels: 4, background } });
  if (!value) return base.png().toBuffer();
  const horizontalPadding = Math.min(11, Math.max(0, Math.floor((width - 1) / 2)));
  const verticalPadding = Math.min(5, Math.max(0, height - 1));
  const textWidth = Math.max(1, width - horizontalPadding * 2);
  const fontFamily = style.fontFamily === "serif" ? "serif" : style.fontFamily === "monospace" ? "monospace" : "sans-serif";
  const rendered = await sharp({
    text: {
      text: `<span foreground="${style.color}" weight="${style.fontWeight}">${escapeMarkup(value)}</span>`,
      font: `${fontFamily} ${style.fontSize}`,
      width: textWidth,
      align: style.textAlign,
      spacing: Math.round(style.fontSize * style.lineHeight),
      wrap: "word-char",
      rgba: true,
      dpi: 72,
    },
  }).png().toBuffer();
  const metadata = await sharp(rendered).metadata();
  const visibleWidth = Math.min(metadata.width ?? 0, width - horizontalPadding);
  const visibleHeight = Math.min(metadata.height ?? 0, height - verticalPadding);
  if (visibleWidth <= 0 || visibleHeight <= 0) return base.png().toBuffer();
  const clipped = visibleWidth === metadata.width && visibleHeight === metadata.height
    ? rendered
    : await sharp(rendered).extract({ left: 0, top: 0, width: visibleWidth, height: visibleHeight }).png().toBuffer();
  return base.composite([{
    input: clipped,
    left: horizontalPadding,
    top: verticalPadding,
  }]).png().toBuffer();
}

async function renderImage(width: number, height: number, value: string, style: ElementStyle,
  readAsset: ReadExportAsset) {
  const background = transparentOrColor(style.backgroundColor);
  if (!value) return sharp({ create: { width, height, channels: 4, background } }).png().toBuffer();
  const { bytes } = await readAsset(value);
  let image = sharp(bytes).rotate().resize(width, height, {
    fit: style.imageFit,
    position: "centre",
    background,
  });
  if (style.backgroundColor !== "transparent") image = image.flatten({ background: style.backgroundColor });
  return image.png().toBuffer();
}

async function renderShape(width: number, height: number, kind: ElementDefinition["kind"], style: ElementStyle) {
  const fill = style.backgroundColor;
  const radius = Math.max(0, Math.min(style.borderRadius, Math.min(width, height) / 2));
  const body = kind === "circle"
    ? `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${fill}"/>`
    : kind === "triangle"
      ? `<polygon points="${width / 2},0 0,${height} ${width},${height}" fill="${fill}"/>`
      : `<rect width="${width}" height="${height}" rx="${radius}" fill="${fill}"/>`;
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`))
    .png().toBuffer();
}

async function renderElement(element: ElementDefinition, value: string, style: ElementStyle,
  width: number, height: number, readAsset: ReadExportAsset) {
  if (element.kind === "text") return renderText(width, height, value, style);
  if (element.kind === "image") return renderImage(width, height, value, style, readAsset);
  return renderShape(width, height, element.kind, style);
}

export function exportDimensions(aspectRatio: EditorDocument["aspectRatio"]) {
  return dimensionsByAspectRatio[aspectRatio];
}

export async function renderSlide(document: EditorDocument, slide: EditorSlide, readAsset: ReadExportAsset) {
  const dimensions = exportDimensions(document.aspectRatio);
  const elements = new Map(document.elements.map((element) => [element.id, element]));
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const placement of slide.placements) {
    if (placement.elementId === BACKGROUND_ELEMENT_ID) continue;
    const element = elements.get(placement.elementId);
    if (!element) continue;
    const frame = pixelFrame(placement.frameOverride ?? element.frame, dimensions);
    const visible = visibleRegion(frame, dimensions);
    if (!visible) continue;
    const style = { ...element.style, ...placement.styleOverride };
    const layer = await renderElement(element, placement.value, style, frame.width, frame.height, readAsset);
    const clipped = visible.width === frame.width && visible.height === frame.height
      ? layer
      : await sharp(layer).extract({
        left: visible.sourceLeft,
        top: visible.sourceTop,
        width: visible.width,
        height: visible.height,
      }).png().toBuffer();
    composites.push({ input: clipped, left: visible.left, top: visible.top });
  }
  return sharp({
    create: { width: dimensions.width, height: dimensions.height, channels: 4, background: slide.backgroundColor },
  }).composite(composites).png().toBuffer();
}
