import type Konva from "konva";
import type { EditorDocument, EditorSlide } from "../../editor/types";
import { pixelFrame } from "../layout";
import { alphaBounds, type SlideLayout } from "./metrics";

/** Reuse the exact rendered nodes, with shadows excluded from spacing measurements. */
export function measureScene(document: EditorDocument, slide: EditorSlide,
  nodes: Map<string, { group: Konva.Group }>, size: {width:number; height:number}): SlideLayout {
  if (nodes.size > 200) throw new Error("Layout inspection supports at most 200 placements per slide.");
  let pixels = 0;
  return { slideId: slide.id, ...size, elements: slide.placements.flatMap(placement => {
    const entry = nodes.get(placement.id), element = document.elements.find(e => e.id === placement.elementId);
    if (!entry || !element) return [];
    const bounds = entry.group.getClientRect({skipShadow:true});
    const x = Math.floor(bounds.x), y = Math.floor(bounds.y);
    const width = Math.max(1, Math.ceil(bounds.x + bounds.width) - x);
    const height = Math.max(1, Math.ceil(bounds.y + bounds.height) - y);
    pixels += width * height;
    if (pixels > 32_000_000) throw new Error("Slide layout inspection exceeds the 32-million-pixel budget.");
    if (width * height > 8_000_000) throw new Error("A placement is too large for layout inspection.");
    const shapes = entry.group.find("Shape") as Konva.Shape[];
    const shadows = shapes.map(shape => shape.shadowEnabled());
    let visible;
    try {
      shapes.forEach(shape => shape.shadowEnabled(false));
      const canvas = entry.group.toCanvas({x,y,width,height,pixelRatio:1});
      const ink = alphaBounds(canvas.getContext("2d")!.getImageData(0,0,width,height).data,width,height);
      visible = ink ? {...ink,x:ink.x+x,y:ink.y+y} : null;
    } finally { shapes.forEach((shape,i) => shape.shadowEnabled(shadows[i])); }
    return [{placementId:placement.id,elementId:element.id,kind:element.kind,role:element.role,
      ...(element.kind === "text" ? {text:placement.value} : {}),
      frame:pixelFrame(placement.frameOverride ?? element.frame,size),visible}];
  }) };
}
