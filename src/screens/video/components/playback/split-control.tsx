import type { RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import { Button } from "@/components/ui/button";
import { usePlayerFrame } from "../../hooks/use-player-frame";
import type { VideoLayer } from "@/lib/video/domain/model";
export function SplitControl({ player, initialFrame, layer, onSplit }: { player: RefObject<PlayerRef | null>; initialFrame: number; layer: Extract<VideoLayer, { kind: "video" }>; onSplit: () => void }) {
  const frame = usePlayerFrame(player, initialFrame);
  return <Button variant="outline" size="sm" disabled={layer.loop || frame <= layer.from || frame >= layer.from + layer.duration} onClick={onSplit}>현재 위치에서 분할</Button>;
}
