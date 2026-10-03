import type { ElementStyle } from "@/lib/content-jobs/editor/types";
import { withBorderDefaults } from "@/lib/content-jobs/editor/elements/style";

export function shapeGeometry(width: number, height: number, input: ElementStyle) {
  const style = withBorderDefaults(input);
  const strokeWidth = style.borderEnabled ? Math.min(style.borderWidth, width, height) : 0;
  const inset = strokeWidth / 2;
  return {
    x: inset, y: inset, width: Math.max(0, width - strokeWidth), height: Math.max(0, height - strokeWidth),
    radius: Math.max(0, Math.min(style.borderRadius, width / 2, height / 2) - inset),
    fill: style.backgroundColor,
    stroke: style.borderColor,
    strokeWidth,
    strokeEnabled: strokeWidth > 0,
  };
}

/** Quadratic corners keep triangle radius editable without changing its outer frame. */
export function roundedTrianglePath(width: number, height: number, radius: number) {
  const points = [{ x: width / 2, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  const corners = points.map((point, i) => {
    const previous = points[(i + 2) % 3];
    const next = points[(i + 1) % 3];
    const distance = Math.min(radius, Math.hypot(previous.x - point.x, previous.y - point.y) / 2,
      Math.hypot(next.x - point.x, next.y - point.y) / 2);
    const towards = (target: typeof point) => {
      const length = Math.hypot(target.x - point.x, target.y - point.y);
      const ratio = length ? distance / length : 0;
      return { x: point.x + (target.x - point.x) * ratio, y: point.y + (target.y - point.y) * ratio };
    };
    return { point, start: towards(previous), end: towards(next) };
  });
  return `M ${corners[0].start.x} ${corners[0].start.y} ` + corners.map(({ point, start, end }, i) =>
    `${i ? `L ${start.x} ${start.y} ` : ""}Q ${point.x} ${point.y} ${end.x} ${end.y}`).join(" ") + " Z";
}
