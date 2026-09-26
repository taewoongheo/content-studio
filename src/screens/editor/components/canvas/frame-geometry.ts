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
  guidesEnabled = true): ElementFrame {
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
