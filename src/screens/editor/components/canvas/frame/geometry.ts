import type { ElementFrame } from "@/lib/content-jobs/editor/types";

export type DragMode = "move" | "nw" | "ne" | "sw" | "se";

const MIN_FRAME_SIZE = 0.04;
const SNAP_DISTANCE = 0.016;
const PRECISION = 10_000;
const DROPPED_IMAGE_LONG_SIDE = 0.5;

export const CANVAS_SAFE_AREA = { left: 0.067, right: 0.067, top: 0.115, bottom: 0.176 } as const;
const HORIZONTAL_GUIDES = [CANVAS_SAFE_AREA.left, 0.5, 1 - CANVAS_SAFE_AREA.right] as const;
const VERTICAL_GUIDES = [CANVAS_SAFE_AREA.top, 0.5, 1 - CANVAS_SAFE_AREA.bottom] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snap(value: number, guides: readonly number[]) {
  const nearest = guides.reduce((best, guide) =>
    Math.abs(value - guide) < Math.abs(value - best) ? guide : best, guides[0]);
  return Math.abs(value - nearest) <= SNAP_DISTANCE ? nearest : value;
}

function round(value: number) {
  return Math.round(value * PRECISION) / PRECISION;
}

export function frameForDroppedImage(
  center: { x: number; y: number },
  imageAspectRatio: number,
  canvasAspectRatio: number,
): ElementFrame {
  const relativeAspectRatio = imageAspectRatio / canvasAspectRatio;
  const width = relativeAspectRatio >= 1
    ? DROPPED_IMAGE_LONG_SIDE
    : DROPPED_IMAGE_LONG_SIDE * relativeAspectRatio;
  const height = relativeAspectRatio >= 1
    ? DROPPED_IMAGE_LONG_SIDE / relativeAspectRatio
    : DROPPED_IMAGE_LONG_SIDE;
  return {
    x: round(clamp(center.x - width / 2, 0, 1 - width)),
    y: round(clamp(center.y - height / 2, 0, 1 - height)),
    width: round(width),
    height: round(height),
  };
}

function snapMovedAxis(start: number, size: number, startGuide: number, endGuide: number) {
  const candidates = [
    { distance: Math.abs(start - startGuide), start: startGuide },
    { distance: Math.abs(start + size / 2 - 0.5), start: 0.5 - size / 2 },
    { distance: Math.abs(start + size - endGuide), start: endGuide - size },
  ];
  const nearest = candidates.reduce((best, candidate) => candidate.distance < best.distance ? candidate : best);
  return nearest.distance <= SNAP_DISTANCE ? nearest.start : start;
}

export function moveOrResizeFrame(frame: ElementFrame, mode: DragMode, deltaX: number, deltaY: number,
  guidesEnabled = true, lockAspectRatio = false): ElementFrame {
  if (mode === "move") {
    let x = frame.x + deltaX;
    let y = frame.y + deltaY;
    if (guidesEnabled) {
      x = snapMovedAxis(x, frame.width, CANVAS_SAFE_AREA.left, 1 - CANVAS_SAFE_AREA.right);
      y = snapMovedAxis(y, frame.height, CANVAS_SAFE_AREA.top, 1 - CANVAS_SAFE_AREA.bottom);
    }
    return { ...frame, x: round(x), y: round(y) };
  }

  if (lockAspectRatio) {
    const horizontalSize = mode.includes("w") ? frame.width - deltaX : frame.width + deltaX;
    const verticalSize = mode.includes("n") ? frame.height - deltaY : frame.height + deltaY;
    const horizontalScale = horizontalSize / frame.width;
    const verticalScale = verticalSize / frame.height;
    const requestedScale = Math.abs(horizontalScale - 1) >= Math.abs(verticalScale - 1)
      ? horizontalScale : verticalScale;
    const minimumScale = Math.max(MIN_FRAME_SIZE / frame.width, MIN_FRAME_SIZE / frame.height);
    let scale = Math.max(requestedScale, minimumScale);

    if (guidesEnabled) {
      const horizontalEdge = mode.includes("w")
        ? frame.x + frame.width - frame.width * scale : frame.x + frame.width * scale;
      const verticalEdge = mode.includes("n")
        ? frame.y + frame.height - frame.height * scale : frame.y + frame.height * scale;
      const snapScales = [
        ...HORIZONTAL_GUIDES.filter((guide) => Math.abs(horizontalEdge - guide) <= SNAP_DISTANCE)
          .map((guide) => (mode.includes("w") ? frame.x + frame.width - guide : guide - frame.x) / frame.width),
        ...VERTICAL_GUIDES.filter((guide) => Math.abs(verticalEdge - guide) <= SNAP_DISTANCE)
          .map((guide) => (mode.includes("n") ? frame.y + frame.height - guide : guide - frame.y) / frame.height),
      ];
      if (snapScales.length > 0) {
        const nearest = snapScales.reduce((best, value) =>
          Math.abs(value - scale) < Math.abs(best - scale) ? value : best);
        scale = Math.max(nearest, minimumScale);
      }
    }

    const width = round(frame.width * scale);
    const height = round(frame.height * scale);
    return {
      x: round(mode.includes("w") ? frame.x + frame.width - width : frame.x),
      y: round(mode.includes("n") ? frame.y + frame.height - height : frame.y),
      width,
      height,
    };
  }

  let left = frame.x;
  let top = frame.y;
  let right = frame.x + frame.width;
  let bottom = frame.y + frame.height;
  if (mode.includes("w")) left = Math.min(left + deltaX, right - MIN_FRAME_SIZE);
  if (mode.includes("e")) right = Math.max(right + deltaX, left + MIN_FRAME_SIZE);
  if (mode.includes("n")) top = Math.min(top + deltaY, bottom - MIN_FRAME_SIZE);
  if (mode.includes("s")) bottom = Math.max(bottom + deltaY, top + MIN_FRAME_SIZE);
  if (guidesEnabled) {
    if (mode.includes("w")) left = Math.min(snap(left, HORIZONTAL_GUIDES), right - MIN_FRAME_SIZE);
    if (mode.includes("e")) right = Math.max(snap(right, HORIZONTAL_GUIDES), left + MIN_FRAME_SIZE);
    if (mode.includes("n")) top = Math.min(snap(top, VERTICAL_GUIDES), bottom - MIN_FRAME_SIZE);
    if (mode.includes("s")) bottom = Math.max(snap(bottom, VERTICAL_GUIDES), top + MIN_FRAME_SIZE);
  }
  left = round(left);
  top = round(top);
  return { x: left, y: top, width: round(right - left), height: round(bottom - top) };
}
