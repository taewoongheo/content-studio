import { useEffect, useRef, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
/** Animate only a composited transform; playback never re-renders the editor or tracks. */
export function VideoPlayhead({ player, ruler, initialFrame, duration, fps, pixelsPerSecond }: { player: RefObject<PlayerRef | null>; ruler: RefObject<HTMLDivElement | null>; initialFrame: number; duration: number; fps: number; pixelsPerSecond: number }) {
  const line = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const p = player.current, element = line.current; if (!p || !element) return;
    let request = 0, sample = p.getCurrentFrame(), sampledAt = performance.now(), playing = p.isPlaying(), waiting = false;
    const paint = (now: number) => {
      const frame = Math.min(duration - 1, Math.max(0, sample + (playing && !waiting ? Math.min(1, (now - sampledAt) * fps / 1000) : 0)));
      element.style.transform = `translate3d(${frame / fps * pixelsPerSecond}px,0,0)`;
      ruler.current?.setAttribute("aria-valuenow", String(Math.floor(frame)));
    };
    const tick = (now: number) => { paint(now); request = playing && !waiting ? requestAnimationFrame(tick) : 0; };
    const start = () => { if (!request && playing && !waiting) request = requestAnimationFrame(tick); };
    const update = (event: { detail: { frame: number } }) => { sample = event.detail.frame; sampledAt = performance.now(); paint(sampledAt); start(); };
    const play = () => { playing = true; sampledAt = performance.now(); start(); };
    const pause = () => { playing = false; if (request) cancelAnimationFrame(request); request = 0; sample = p.getCurrentFrame(); paint(performance.now()); };
    const buffer = () => { waiting = true; if (request) cancelAnimationFrame(request); request = 0; sample = p.getCurrentFrame(); paint(performance.now()); };
    const resume = () => { waiting = false; sample = p.getCurrentFrame(); sampledAt = performance.now(); start(); };
    p.addEventListener("frameupdate", update); p.addEventListener("seeked", update); p.addEventListener("play", play); p.addEventListener("pause", pause); p.addEventListener("ended", pause); p.addEventListener("waiting", buffer); p.addEventListener("resume", resume);
    paint(performance.now()); start();
    return () => { if (request) cancelAnimationFrame(request); p.removeEventListener("frameupdate", update); p.removeEventListener("seeked", update); p.removeEventListener("play", play); p.removeEventListener("pause", pause); p.removeEventListener("ended", pause); p.removeEventListener("waiting", buffer); p.removeEventListener("resume", resume); };
  }, [player, ruler, duration, fps, pixelsPerSecond]);
  return <div ref={line} aria-label="재생 헤드" className="pointer-events-none absolute top-0 bottom-0 left-[150px] z-40 w-px bg-red-400 will-change-transform" style={{ transform: `translate3d(${initialFrame / fps * pixelsPerSecond}px,0,0)` }}><div className="absolute -left-1 top-0 size-2 rounded-b-sm bg-red-500" /></div>;
}
