import Konva from "konva";
import type { EditorDocument, EditorSlide, ElementFrame } from "@/lib/content-jobs/editor/types";
import { BACKGROUND_ELEMENT_ID } from "@/lib/content-jobs/editor/document";
import { artworkSize, fittedImage, pixelFrame } from "./layout";
import type { ArtworkImageLoader } from "./assets";

type Options = {
  document: EditorDocument;
  slide: EditorSlide;
  jobId: string;
  loadImage: ArtworkImageLoader;
  showPlaceholders?: boolean;
  framePreview?: { placementId: string; frame: ElementFrame } | null;
  allowOverflow?: boolean;
};

/** Both the editor and ZIP export paint this exact scene, in document layer order. */
export async function renderArtwork(options: Options) {
  const { document: doc, slide, jobId, loadImage, showPlaceholders = false, framePreview } = options;
  const size = artworkSize(doc.aspectRatio);
  const elements = new Map(doc.elements.map((element) => [element.id, element]));
  await window.document.fonts.ready;
  const images = new Map(await Promise.all(slide.placements.flatMap((placement) => {
    if (elements.get(placement.elementId)?.kind !== "image" || !placement.value) return [];
    const url = `/api/content-jobs/${encodeURIComponent(jobId)}/assets/${encodeURIComponent(placement.value)}`;
    return [loadImage(url).then((image) => [placement.id, image] as const)];
  })));

  const container = window.document.createElement("div");
  const stage = new Konva.Stage({ container, ...size });
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);
  try {
    layer.add(new Konva.Rect({ ...size, fill: slide.backgroundColor }));
    for (const placement of slide.placements) {
      const element = elements.get(placement.elementId);
      if (!element || element.id === BACKGROUND_ELEMENT_ID) continue;
      const frame = pixelFrame(framePreview?.placementId === placement.id ? framePreview.frame
        : placement.frameOverride ?? element.frame, size);
      const style = { ...element.style, ...placement.styleOverride };
      const group = new Konva.Group({ x: frame.x, y: frame.y });
      layer.add(group);
      const bounds = { width: frame.width, height: frame.height };
      const radius = Math.min(style.borderRadius, frame.width / 2, frame.height / 2);

      if (element.kind === "circle") {
        group.add(new Konva.Ellipse({ x: frame.width / 2, y: frame.height / 2,
          radiusX: frame.width / 2, radiusY: frame.height / 2, fill: style.backgroundColor }));
      } else if (element.kind === "triangle") {
        group.add(new Konva.Line({ points: [frame.width / 2, 0, 0, frame.height, frame.width, frame.height],
          closed: true, fill: style.backgroundColor }));
      } else {
        group.add(new Konva.Rect({ ...bounds, cornerRadius: radius, fill: style.backgroundColor }));
        if (element.kind === "image") {
          const image = images.get(placement.id);
          if (image) {
            const imageGroup = new Konva.Group({ clipFunc(context) {
              context.beginPath();
              context.roundRect(0, 0, frame.width, frame.height, radius);
              context.closePath();
            } });
            imageGroup.add(new Konva.Image({ image,
              ...fittedImage({ width: image.naturalWidth, height: image.naturalHeight }, bounds, style.imageFit) }));
            group.add(imageGroup);
          } else if (showPlaceholders) {
            group.add(new Konva.Rect({ ...bounds, stroke: "#aaa", strokeWidth: 2, dash: [8, 8] }));
            group.add(new Konva.Text({ ...bounds, text: element.name, fontSize: 32, fill: "#777", align: "center", verticalAlign: "middle" }));
          }
        } else if (element.kind === "text" && (placement.value || showPlaceholders)) {
          // Height controls selection, not a destructive crop of glyphs or wrapped lines.
          group.add(new Konva.Text({ x: 10.8, y: 5.4, width: Math.max(1, frame.width - 21.6),
            text: placement.value || element.name, fontSize: style.fontSize,
            fontFamily: style.fontFamily, fontStyle: String(style.fontWeight),
            lineHeight: style.lineHeight, align: style.textAlign,
            fill: placement.value ? style.color : "#999", wrap: "word" }));
        }
      }
    }
    const bounds = layer.getClientRect({ skipShadow: true });
    const x = options.allowOverflow ? Math.floor(Math.min(0, bounds.x)) : 0;
    const y = options.allowOverflow ? Math.floor(Math.min(0, bounds.y)) : 0;
    const width = options.allowOverflow ? Math.ceil(Math.max(size.width, bounds.x + bounds.width) - x) : size.width;
    const height = options.allowOverflow ? Math.ceil(Math.max(size.height, bounds.y + bounds.height) - y) : size.height;
    layer.position({ x: -x, y: -y });
    stage.size({ width, height });
    layer.draw();
    const canvas = stage.toCanvas({ pixelRatio: 1 });
    return { canvas, x, y, width, height, size };
  } finally {
    stage.destroy();
  }
}
