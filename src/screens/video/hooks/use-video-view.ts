"use client";
import type { PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState, type RefObject } from "react";
type VideoView = { frame: number; selected: string | null; guides: boolean; unlockedRatios: string[] };
export function useVideoView(tabId: string, duration: number, player: RefObject<PlayerRef | null>) {
  const [initial] = useState<VideoView>(() => {
    try { const view = JSON.parse(sessionStorage.getItem(`video-view:${tabId}`) ?? "null"); if (view && Number.isInteger(view.frame) && (typeof view.selected === "string" || view.selected === null) && typeof view.guides === "boolean") return { ...view, unlockedRatios: Array.isArray(view.unlockedRatios) ? view.unlockedRatios.filter((id: unknown) => typeof id === "string") : [], frame: Math.max(0, Math.min(duration - 1, view.frame)) }; } catch { /* Storage may be unavailable. */ }
    return { frame: 0, selected: null, guides: true, unlockedRatios: [] };
  });
  const frameRef = useRef(initial.frame);
  const [selected, setSelected] = useState(initial.selected), [guides, setGuides] = useState(initial.guides);
  const [unlockedRatios, setUnlockedRatios] = useState(initial.unlockedRatios);
  const latest = useRef(initial);
  useEffect(() => { latest.current = { frame: initial.frame, selected, guides, unlockedRatios }; }, [initial.frame, selected, guides, unlockedRatios]);
  useEffect(() => {
    const p = player.current;
    const update = (event: { detail: { frame: number } }) => { frameRef.current = event.detail.frame; };
    p?.addEventListener("frameupdate", update); p?.addEventListener("seeked", update);
    const persist = () => { try { sessionStorage.setItem(`video-view:${tabId}`, JSON.stringify({ ...latest.current, frame: frameRef.current })); } catch { /* View state is optional. */ } };
    window.addEventListener("pagehide", persist);
    return () => { persist(); p?.removeEventListener("frameupdate", update); p?.removeEventListener("seeked", update); window.removeEventListener("pagehide", persist); };
  }, [tabId, player]);
  return { initialFrame: initial.frame, frameRef, selected, setSelected, guides, setGuides, unlockedRatios, setUnlockedRatios };
}
