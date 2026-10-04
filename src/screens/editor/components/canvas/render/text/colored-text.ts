import Konva from "konva";
import type { TextColorRange } from "@/lib/content-jobs/editor/types";
import { lineColorStops, sourceLineOffsets } from "./color-layout";

/** Reuse Konva's wrapping; each complete line stays one shaped text run, with color-only paint changes. */
export function addColoredText(group: Konva.Group, text: Konva.Text, ranges: TextColorRange[]) {
  if (!ranges.length) { group.add(text); return; }
  const offsets = sourceLineOffsets(text.text(), text.textArr);
  const context = document.createElement("canvas").getContext("2d")!;
  context.font = `${text.fontStyle()} ${text.fontSize()}px ${text.fontFamily()}`;
  for (const [index, line] of text.textArr.entries()) {
    const node = text.clone({ text: line.text, wrap: "none", y: text.y() + index * text.fontSize() * text.lineHeight() });
    const stops = lineColorStops(line.text, offsets[index], ranges, String(text.fill()), (value) => context.measureText(value).width);
    if (stops) {
      const x = text.align() === "center" ? (text.width() - line.width) / 2
        : text.align() === "right" ? text.width() - line.width : 0;
      node.fillLinearGradientStartPoint({ x, y: 0 });
      node.fillLinearGradientEndPoint({ x: x + line.width, y: 0 });
      node.fillLinearGradientColorStops(stops);
      node.fillPriority("linear-gradient");
    }
    group.add(node);
  }
  text.destroy();
}
