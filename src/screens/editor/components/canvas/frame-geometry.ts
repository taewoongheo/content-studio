import type { ElementFrame } from "@/lib/content-jobs/editor/types";

export type DragMode = "move" | "nw" | "ne" | "sw" | "se";

const MIN_FRAME_SIZE = 0.04;
const SNAP_DISTANCE = 0.016;
const PRECISION = 10_000;

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
    let x = clamp(frame.x + deltaX, 0, 1 - frame.width);
    let y = clamp(frame.y + deltaY, 0, 1 - frame.height);
    if (guidesEnabled) {
      x = snapMovedAxis(x, frame.width, CANVAS_SAFE_AREA.left, 1 - CANVAS_SAFE_AREA.right);
      y = snapMovedAxis(y, frame.height, CANVAS_SAFE_AREA.top, 1 - CANVAS_SAFE_AREA.bottom);
    }
    return { ...frame, x: Math.min(round(clamp(x, 0, 1 - frame.width)), 1 - frame.width),
      y: Math.min(round(clamp(y, 0, 1 - frame.height)), 1 - frame.height) };
  }

  if (lockAspectRatio) {
    const horizontalSize = mode.includes("w") ? frame.width - deltaX : frame.width + deltaX;
    const verticalSize = mode.includes("n") ? frame.height - deltaY : frame.height + deltaY;
    const horizontalScale = horizontalSize / frame.width;
    const verticalScale = verticalSize / frame.height;
    const requestedScale = Math.abs(horizontalScale - 1) >= Math.abs(verticalScale - 1)
      ? horizontalScale : verticalScale;
    const maximumWidth = mode.includes("w") ? frame.x + frame.width : 1 - frame.x;
    const maximumHeight = mode.includes("n") ? frame.y + frame.height : 1 - frame.y;
    const minimumScale = Math.max(MIN_FRAME_SIZE / frame.width, MIN_FRAME_SIZE / frame.height);
    const maximumScale = Math.min(maximumWidth / frame.width, maximumHeight / frame.height);
    let scale = clamp(requestedScale, minimumScale, maximumScale);

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
        scale = clamp(nearest, minimumScale, maximumScale);
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
  if (mode.includes("w")) left = clamp(left + deltaX, 0, right - MIN_FRAME_SIZE);
  if (mode.includes("e")) right = clamp(right + deltaX, left + MIN_FRAME_SIZE, 1);
  if (mode.includes("n")) top = clamp(top + deltaY, 0, bottom - MIN_FRAME_SIZE);
  if (mode.includes("s")) bottom = clamp(bottom + deltaY, top + MIN_FRAME_SIZE, 1);
  if (guidesEnabled) {
    if (mode.includes("w")) left = clamp(snap(left, HORIZONTAL_GUIDES), 0, right - MIN_FRAME_SIZE);
    if (mode.includes("e")) right = clamp(snap(right, HORIZONTAL_GUIDES), left + MIN_FRAME_SIZE, 1);
    if (mode.includes("n")) top = clamp(snap(top, VERTICAL_GUIDES), 0, bottom - MIN_FRAME_SIZE);
    if (mode.includes("s")) bottom = clamp(snap(bottom, VERTICAL_GUIDES), top + MIN_FRAME_SIZE, 1);
  }
  left = round(left);
  top = round(top);
  return { x: left, y: top, width: Math.min(round(right - left), 1 - left),
    height: Math.min(round(bottom - top), 1 - top) };
}
