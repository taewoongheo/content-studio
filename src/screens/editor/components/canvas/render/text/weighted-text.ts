import Konva from "konva";
import type { TextColorRange, TextWeightRange } from "@/lib/content-jobs/editor/types";
import { lineColorStops } from "./layout/color-layout";
import { layoutWeightedText } from "./layout/weight-layout";

export function addWeightedText(group: Konva.Group, text: Konva.Text, colors: TextColorRange[], weights: TextWeightRange[],
  frameHeight: number, baseWeight: number, fontStyle: (weight: number) => string) {
  const context = document.createElement("canvas").getContext("2d")!;
  const measure = (value: string, weight: number) => {
    context.font = `${fontStyle(weight)} ${text.fontSize()}px ${text.fontFamily()}`;
    return context.measureText(value).width;
  };
  const lines = layoutWeightedText(text.text(), weights, baseWeight, text.width(), measure);
  const lineHeight = text.fontSize() * text.lineHeight();
  const top = (frameHeight - lines.length * lineHeight) / 2;
  for (const [index, line] of lines.entries()) {
    let x = text.x() + (text.align() === "center" ? (text.width() - line.width) / 2
      : text.align() === "right" ? text.width() - line.width : 0);
    for (const run of line.runs) {
      const node = text.clone({ text: run.text, x, y: top + index * lineHeight,
        width: run.width + 1, align: "left", wrap: "none", fontStyle: fontStyle(run.fontWeight) });
      const stops = lineColorStops(run.text, run.start, colors, String(text.fill()), value => measure(value, run.fontWeight));
      if (stops) {
        node.fillLinearGradientStartPoint({ x: 0, y: 0 });
        node.fillLinearGradientEndPoint({ x: run.width, y: 0 });
        node.fillLinearGradientColorStops(stops);
        node.fillPriority("linear-gradient");
      }
      group.add(node);
      x += run.width;
    }
  }
  text.destroy();
}
