import { useState, type PointerEvent, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import type { VideoDocument, VideoLayer } from "@/lib/video/domain/model";
import { usePlayerFrame } from "../../hooks/use-player-frame";
export function CanvasSelection({ document: doc, player, initialFrame, scale, selected, guides, unlockedRatios, onSelect, onChange }: {
  document: VideoDocument; player: RefObject<PlayerRef | null>; initialFrame: number; scale: number; selected: string | null; guides: boolean; unlockedRatios: string[];
  onSelect: (id: string | null) => void; onChange: (layer: VideoLayer) => void;
}) {
  const frame = usePlayerFrame(player, initialFrame);
  const [snaps, setSnaps] = useState<{ x?: number; y?: number }>({});
  function drag(e: PointerEvent<HTMLElement>, layer: VideoLayer, resize = false) {
    e.preventDefault(); e.stopPropagation(); onSelect(layer.id); player.current?.pause();
    const target = e.currentTarget, startX = e.clientX, startY = e.clientY;
    target.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => {
      const dx = (ev.clientX - startX) / scale, dy = (ev.clientY - startY) / scale;
      if (resize) {
        const angle = layer.rotation * Math.PI / 180;
        const localX = dx * Math.cos(angle) + dy * Math.sin(angle), localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
        if ((layer.kind === "video" || layer.kind === "image") && !unlockedRatios.includes(layer.id) && !ev.shiftKey) {
          const factor = Math.max(1 / Math.min(layer.width, layer.height), Math.min(7680 / Math.max(layer.width, layer.height), 1 + (Math.abs(localX / layer.width) >= Math.abs(localY / layer.height) ? localX / layer.width : localY / layer.height)));
          onChange({ ...layer, width: Math.max(1, Math.round(layer.width * factor)), height: Math.max(1, Math.round(layer.height * factor)) });
        } else onChange({ ...layer, width: Math.max(1, Math.min(7680, Math.round(layer.width + localX))), height: Math.max(1, Math.min(7680, Math.round(layer.height + localY))) });
      }
      else {
        let x = Math.round(layer.x + dx), y = Math.round(layer.y + dy);
        const snap: { x?: number; y?: number } = {};
        if (guides && !ev.altKey) {
          for (const line of [0, doc.width / 2, doc.width]) for (const anchor of [0, layer.width / 2, layer.width]) if (Math.abs(x + anchor - line) < 8 / scale) { x = line - anchor; snap.x = line; }
          for (const line of [0, doc.height / 2, doc.height]) for (const anchor of [0, layer.height / 2, layer.height]) if (Math.abs(y + anchor - line) < 8 / scale) { y = line - anchor; snap.y = line; }
        }
        setSnaps(snap); onChange({ ...layer, x: Math.max(-7680, Math.min(7680, x)), y: Math.max(-7680, Math.min(7680, y)) });
      }
    };
    const up = () => { setSnaps({}); target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", up); target.removeEventListener("pointercancel", up); };
    target.addEventListener("pointermove", move); target.addEventListener("pointerup", up); target.addEventListener("pointercancel", up);
  }
  return (
      <div className="absolute inset-0 overflow-hidden" onClick={() => onSelect(null)}>
        {doc.layers.filter(l => l.kind !== "audio" && frame >= l.from && frame < l.from + l.duration).map(l => <div key={l.id}
          role="button" tabIndex={0} aria-label={`${l.name} 선택`} onClick={e => { e.stopPropagation(); onSelect(l.id); }} onKeyDown={e => { if (e.key === "Enter") onSelect(l.id); }}
          onPointerDown={e => drag(e, l)} className={`absolute touch-none cursor-move ${selected === l.id ? "border-2 border-sky-400" : "hover:outline hover:outline-sky-400/50"}`}
          style={{ left: l.x * scale, top: l.y * scale, width: l.width * scale, height: l.height * scale, transform: `rotate(${l.rotation}deg)` }}>
          {selected === l.id && <button type="button" aria-label={`${l.name} 크기 조절`} title="드래그해 크기 조절 · Shift: 비율 해제" className="absolute right-0 bottom-0 size-4 cursor-nwse-resize rounded-sm border-2 border-white bg-sky-500 shadow-sm" onClick={e => e.stopPropagation()} onPointerDown={e => drag(e, l, true)}
            onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return; e.preventDefault(); e.stopPropagation(); const amount = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -10 : 10; const width = Math.max(1, Math.min(7680, l.width + amount)); onChange({ ...l, width, height: (l.kind === "video" || l.kind === "image") && !unlockedRatios.includes(l.id) ? Math.max(1, Math.min(7680, Math.round(l.height * width / l.width))) : l.height }); }} />}
        </div>)}
        {guides && <div aria-label="안전 영역 가이드" className="pointer-events-none absolute z-20 border border-dashed border-sky-600" style={{ left: "6.7%", right: "6.7%", top: "11.5%", bottom: "17.7%", boxShadow: "0 0 0 1px #FFFFFF, inset 0 0 0 1px #FFFFFF" }} />}
        {snaps.x !== undefined && <div className="pointer-events-none absolute inset-y-0 z-30 w-px bg-sky-400" style={{ left: snaps.x * scale }} />}
        {snaps.y !== undefined && <div className="pointer-events-none absolute inset-x-0 z-30 h-px bg-sky-400" style={{ top: snaps.y * scale }} />}
      </div>
  );
}
