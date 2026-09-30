import type { ElementFrame } from "@/lib/content-jobs/editor/types";

export type DragMode = "move" | "nw" | "ne" | "sw" | "se";

const MIN_FRAME_SIZE = 0.04;
const SNAP_DISTANCE = 0.016;
const PRECISION = 10_000;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snap(value: number, guides: readonly number[]) {
  const nearest = guides.find((guide) => Math.abs(value - guide) <= SNAP_DISTANCE);
  return nearest ?? value;
}

function round(value: number) {
  return Math.round(value * PRECISION) / PRECISION;
}

export function moveOrResizeFrame(frame: ElementFrame, mode: DragMode, deltaX: number, deltaY: number,
  guidesEnabled = true, lockAspectRatio = false): ElementFrame {
  if (mode === "move") {
    let x = clamp(frame.x + deltaX, 0, 1 - frame.width);
    let y = clamp(frame.y + deltaY, 0, 1 - frame.height);
    if (guidesEnabled) {
      x = snap(x + frame.width / 2, [0.5]) - frame.width / 2;
      y = snap(y + frame.height / 2, [0.5]) - frame.height / 2;
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
        Math.abs(horizontalEdge - 0.5) <= SNAP_DISTANCE
          ? (mode.includes("w") ? frame.x + frame.width - 0.5 : 0.5 - frame.x) / frame.width : null,
        Math.abs(verticalEdge - 0.5) <= SNAP_DISTANCE
          ? (mode.includes("n") ? frame.y + frame.height - 0.5 : 0.5 - frame.y) / frame.height : null,
      ].filter((value): value is number => value !== null);
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
    if (mode.includes("w")) left = clamp(snap(left, [0.5]), 0, right - MIN_FRAME_SIZE);
    if (mode.includes("e")) right = clamp(snap(right, [0.5]), left + MIN_FRAME_SIZE, 1);
    if (mode.includes("n")) top = clamp(snap(top, [0.5]), 0, bottom - MIN_FRAME_SIZE);
    if (mode.includes("s")) bottom = clamp(snap(bottom, [0.5]), top + MIN_FRAME_SIZE, 1);
  }
  left = round(left);
  top = round(top);
  return { x: left, y: top, width: Math.min(round(right - left), 1 - left),
    height: Math.min(round(bottom - top), 1 - top) };
}
