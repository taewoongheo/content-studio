export type Bounds = { x: number; y: number; width: number; height: number };
export type LayoutElement = {
  placementId: string; elementId: string; kind: string; role: string; text?: string;
  frame: Bounds; visible: Bounds | null;
};
export type SlideLayout = { slideId: string; width: number; height: number; elements: LayoutElement[] };

/** Scan rendered alpha, not editor frames. Ignore near-transparent antialiasing. */
export function alphaBounds(data: Uint8ClampedArray, width: number, height: number): Bounds | null {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] < 32) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
export function visibleGap(from: Bounds, to: Bounds, axis: "x" | "y") {
  return axis === "y" ? to.y - from.y - from.height : to.x - from.x - from.width;
}
