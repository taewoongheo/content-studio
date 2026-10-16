"use client";
import { useEffect, useState, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
/** Only the small UI that displays time subscribes to playback frames. */
export function usePlayerFrame(player: RefObject<PlayerRef | null>, initialFrame: number) {
  const [frame, setFrame] = useState(initialFrame);
  useEffect(() => {
    const p = player.current; if (!p) return;
    const update = (event: { detail: { frame: number } }) => setFrame(event.detail.frame);
    p.addEventListener("frameupdate", update); p.addEventListener("seeked", update);
    return () => { p.removeEventListener("frameupdate", update); p.removeEventListener("seeked", update); };
  }, [player]);
  return frame;
}
