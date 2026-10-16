import type { PlayerRef } from "@remotion/player";
import { VideoPlayhead } from "./video-playhead";
import { useRef, type RefObject, type PointerEvent } from "react";
import {
  videoDuration,
  type VideoDocument,
  type VideoLayer,
} from "@/lib/video/domain/model";
export function VideoTimeline({
  document: doc,
  player,
  initialFrame,
  selected,
  onSelect,
  onSeek,
  onChange,
}: {
  document: VideoDocument;
  player: RefObject<PlayerRef | null>;
  initialFrame: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onSeek: (frame: number) => void;
  onChange: (layer: VideoLayer) => void;
}) {
  const duration = videoDuration(doc),
    seconds = duration / doc.fps,
    pixelsPerSecond = 70,
    width = Math.max(650, (seconds + 1) * pixelsPerSecond);
  const pixelsPerFrame = pixelsPerSecond / doc.fps;
  const ruler = useRef<HTMLDivElement>(null);
  function drag(
    e: PointerEvent<HTMLDivElement>,
    l: VideoLayer,
    mode: "move" | "start" | "end",
  ) {
    e.preventDefault();
    e.stopPropagation();
    onSelect(l.id);
    const target = e.currentTarget,
      startX = e.clientX;
    target.setPointerCapture(e.pointerId);
    const move = (event: globalThis.PointerEvent) => {
      const delta = Math.round((event.clientX - startX) / pixelsPerFrame);
      if (mode === "move")
        onChange({
          ...l,
          from: Math.max(0, Math.min(108000 - l.duration, l.from + delta)),
        });
      else if (mode === "end") {
        const media = (l.kind === "video" || l.kind === "audio") && !l.loop;
        const max = media
          ? Math.min(l.sourceFrames - l.trimStart, 108000 - l.from)
          : 108000 - l.from;
        const duration = Math.max(1, Math.min(max, l.duration + delta));
        onChange({
          ...l,
          duration,
          ...(media ? { trimEnd: l.trimStart + duration } : {}),
        });
      } else {
        const minDelta =
          (l.kind === "video" || l.kind === "audio") && !l.loop
            ? -(l.kind === "video" && l.sequence
                ? l.trimStart
                : Math.min(l.from, l.trimStart))
            : -l.from;
        const amount = Math.max(minDelta, Math.min(l.duration - 1, delta));
        onChange({
          ...l,
          from: l.from + amount,
          duration: l.duration - amount,
          ...((l.kind === "video" || l.kind === "audio") && !l.loop
            ? { trimStart: l.trimStart + amount }
            : {}),
        } as VideoLayer);
      }
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }
  const colors = {
    video: "bg-sky-800/70",
    audio: "bg-emerald-800/70",
    text: "bg-violet-800/70",
    image: "bg-amber-800/70",
    shape: "bg-slate-700/80",
  };
  return (
    <section
      aria-label="타임라인"
      className="min-h-32 max-h-50 shrink-0 overflow-auto border-t bg-muted/30"
    >
      <div className="relative pb-3" style={{ width: width + 150 }}>
        <div className="sticky top-0 z-20 flex h-8 border-b bg-background">
          <span className="sticky left-0 z-50 flex w-[150px] shrink-0 items-center bg-background px-3 text-xs">
            타임라인 · {seconds.toFixed(1)}초
          </span>
          <div
            ref={ruler}
            role="slider"
            tabIndex={0}
            aria-label="재생 위치"
            aria-valuemin={0}
            aria-valuemax={duration - 1}
            aria-valuenow={Math.min(initialFrame, duration - 1)}
            className="relative cursor-crosshair"
            style={{ width }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                onSeek(
                  Math.max(
                    0,
                    Math.min(
                      duration - 1,
                      (player.current?.getCurrentFrame() ?? initialFrame) +
                        (e.key === "ArrowLeft" ? -1 : 1),
                    ),
                  ),
                );
              }
            }}
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onSeek(
                Math.max(
                  0,
                  Math.min(
                    duration - 1,
                    Math.round((e.clientX - rect.left) / pixelsPerFrame),
                  ),
                ),
              );
            }}
          >
            {Array.from(
              { length: Math.floor(width / pixelsPerSecond) + 1 },
              (_, i) => {
                const t = i;
                return (
                  <span
                    key={i}
                    className="absolute border-l px-1 pt-2 text-[10px] text-muted-foreground"
                    style={{ left: t * pixelsPerSecond }}
                  >
                    {t.toFixed(seconds > 30 ? 0 : 1)}s
                  </span>
                );
              },
            )}
          </div>
        </div>
        <VideoPlayhead
          player={player}
          ruler={ruler}
          initialFrame={initialFrame}
          duration={duration}
          fps={doc.fps}
          pixelsPerSecond={pixelsPerSecond}
        />
        {doc.layers.map((l) => (
          <div
            key={l.id}
            className="relative flex h-10 border-b border-border/50"
          >
            <button
              className={`sticky left-0 z-10 w-[150px] shrink-0 truncate border-r px-3 text-left text-xs ${selected === l.id ? "bg-accent" : "bg-background"}`}
              onClick={() => {
                onSelect(l.id);
                onSeek(l.from);
              }}
            >
              {l.name}
            </button>
            <div className="relative" style={{ width }}>
              <div
                role="button"
                tabIndex={0}
                aria-label={`${l.name} 타이밍`}
                onClick={() => onSelect(l.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelect(l.id);
                }}
                onPointerDown={(e) => drag(e, l, "move")}
                className={`absolute top-1 flex h-8 touch-none items-center overflow-hidden rounded border text-xs text-white ${colors[l.kind]} ${selected === l.id ? "ring-2 ring-foreground ring-offset-1" : "border-white/10"}`}
                style={{
                  left: l.from * pixelsPerFrame,
                  width: Math.max(10, l.duration * pixelsPerFrame),
                }}
              >
                <div
                  title="시작 자르기"
                  className="h-full w-2 shrink-0 cursor-ew-resize bg-white/15"
                  onPointerDown={(e) => drag(e, l, "start")}
                />
                <span className="min-w-0 flex-1 truncate px-2">{l.name}</span>
                <div
                  title="길이 조절"
                  className="h-full w-2 shrink-0 cursor-ew-resize bg-white/15"
                  onPointerDown={(e) => drag(e, l, "end")}
                />
              </div>
            </div>
          </div>
        ))}
        {!doc.layers.length && (
          <p className="p-6 text-xs text-muted-foreground">
            영상·텍스트·도형을 추가해 시작하세요. 요소별 시작 시점과 길이를
            조절할 수 있습니다.
          </p>
        )}
      </div>
    </section>
  );
}
