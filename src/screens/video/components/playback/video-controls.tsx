import { useEffect, useState, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerFrame } from "../../hooks/use-player-frame";
export function VideoControls({
  player,
  initialFrame,
  duration,
  fps,
  guides,
  onGuides,
  onSeek,
}: {
  player: RefObject<PlayerRef | null>;
  initialFrame: number;
  duration: number;
  fps: number;
  guides: boolean;
  onGuides: (value: boolean) => void;
  onSeek: (frame: number) => void;
}) {
  const frame = usePlayerFrame(player, initialFrame);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const play = () => setPlaying(true),
      pause = () => setPlaying(false);
    p.addEventListener("play", play);
    p.addEventListener("pause", pause);
    p.addEventListener("ended", pause);
    return () => {
      p.removeEventListener("play", play);
      p.removeEventListener("pause", pause);
      p.removeEventListener("ended", pause);
    };
  }, [player]);

  return (
    <nav aria-label="영상 재생" className="shrink-0 border-t px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="mr-1 text-sm font-semibold">재생</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSeek(Math.max(0, frame - 1))}
            aria-label="이전 프레임"
          >
            −1f
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={playing ? "일시정지" : "재생"}
            onClick={() => player.current?.toggle()}
          >
            {playing ? <Pause /> : <Play />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSeek(Math.min(duration - 1, frame + 1))}
            aria-label="다음 프레임"
          >
            +1f
          </Button>
          <span className="ml-1 font-mono text-xs tabular-nums">
            {(frame / fps).toFixed(2)} / {(duration / fps).toFixed(2)}s
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            className="size-4 accent-primary"
            type="checkbox"
            checked={guides}
            onChange={(e) => onGuides(e.target.checked)}
          />
          가이드
        </label>
      </div>
    </nav>
  );
}
