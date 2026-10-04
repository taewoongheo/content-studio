import Konva from "konva";
import type { EditorDocument, EditorSlide, ElementFrame } from "@/lib/content-jobs/editor/types";
import { BACKGROUND_ELEMENT_ID } from "@/lib/content-jobs/editor/document";
import { artworkSize, fittedImage, pixelFrame, renderImageUrl } from "./layout";
import { loadArtworkImages, type ArtworkImageLoader } from "./assets";
import { roundedTrianglePath, shapeGeometry } from "./shapes/geometry";
import { canvasFont } from "./fonts";
import { addColoredText } from "./text/colored-text";

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
  await Promise.all(slide.placements.flatMap((placement) => {
    const element = elements.get(placement.elementId);
    if (element?.kind !== "text") return [];
    const style = { ...element.style, ...placement.styleOverride };
    const font = canvasFont(style.fontFamily, style.fontWeight, style.fontStyle);
    return [window.document.fonts.load(`${font.style} ${style.fontSize}px ${font.family}`, placement.value || element.name)];
  }));
  const images = await loadArtworkImages(slide.placements.flatMap((placement) => {
    const element = elements.get(placement.elementId);
    if (element?.kind !== "image" || !placement.value) return [];
    // Reuse the committed-size derivative throughout a drag; resample once after resize commits.
    const box = pixelFrame(placement.frameOverride ?? element.frame, size);
    const fit = placement.styleOverride?.imageFit ?? element.style.imageFit;
    const url = renderImageUrl(jobId, placement.value, box, fit);
    return [{ placementId: placement.id, url }];
  }), loadImage, showPlaceholders);

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
      const shape = shapeGeometry(frame.width, frame.height, style);

      if (element.kind === "circle") {
        group.add(new Konva.Ellipse({ x: frame.width / 2, y: frame.height / 2,
          radiusX: shape.width / 2, radiusY: shape.height / 2, fill: shape.fill,
          stroke: shape.stroke, strokeWidth: shape.strokeWidth, strokeEnabled: shape.strokeEnabled }));
      } else if (element.kind === "triangle") {
        group.add(new Konva.Path({ x: shape.x, y: shape.y,
          data: roundedTrianglePath(shape.width, shape.height, shape.radius),
          fill: shape.fill, stroke: shape.stroke, strokeWidth: shape.strokeWidth,
          strokeEnabled: shape.strokeEnabled, lineJoin: "round" }));
      } else if (element.kind === "rectangle") {
        group.add(new Konva.Rect({ ...shape, cornerRadius: shape.radius }));
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
          const font = canvasFont(style.fontFamily, style.fontWeight, style.fontStyle);
          // Measure the wrapped block before centering; a fixed Text height would crop excess lines.
          const text = new Konva.Text({ x: 10.8, width: Math.max(1, frame.width - 21.6),
            text: placement.value || element.name, fontSize: style.fontSize,
            fontFamily: font.family, fontStyle: font.style,
            lineHeight: style.lineHeight, align: style.textAlign, verticalAlign: "top", padding: 0,
            fill: placement.value ? style.color : "#999", wrap: "word" });
          text.y((frame.height - text.height()) / 2);
          addColoredText(group, text, placement.textColors ?? []);
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
