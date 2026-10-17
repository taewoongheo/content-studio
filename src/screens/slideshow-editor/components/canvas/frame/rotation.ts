import type { ElementFrame } from "@/domains/slideshow/editor/types";
import { moveOrResizeFrame, type DragMode } from "./geometry";

/** Resize in the rotated local axes while keeping the opposite corner fixed. */
export function moveOrResizeRotatedFrame(frame: ElementFrame, mode: DragMode, deltaX: number, deltaY: number,
  canvasWidth: number, canvasHeight: number, rotation: number, guidesEnabled: boolean, lockAspectRatio: boolean): ElementFrame {
  if (!rotation || mode === "move")
    return moveOrResizeFrame(frame, mode, deltaX / canvasWidth, deltaY / canvasHeight, guidesEnabled, lockAspectRatio);
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const next = moveOrResizeFrame(frame, mode,
    (cos * deltaX + sin * deltaY) / canvasWidth,
    (-sin * deltaX + cos * deltaY) / canvasHeight, false, lockAspectRatio);
  const centerX = (next.x + next.width / 2 - frame.x - frame.width / 2) * canvasWidth;
  const centerY = (next.y + next.height / 2 - frame.y - frame.height / 2) * canvasHeight;
  return { ...next,
    x: frame.x + frame.width / 2 + (cos * centerX - sin * centerY) / canvasWidth - next.width / 2,
    y: frame.y + frame.height / 2 + (sin * centerX + cos * centerY) / canvasHeight - next.height / 2,
  };
}
