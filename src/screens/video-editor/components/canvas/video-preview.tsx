"use client";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { CanvasSelection } from "./canvas-selection";
import { VideoComposition } from "@/domains/video/remotion/composition";
import { videoDuration, type VideoDocument, type VideoLayer } from "@/domains/video/domain/model";
export function VideoPreview({ document: doc, projectId, player, initialFrame, selected, guides, onSelect, onChange, onFiles, unlockedRatios }: {
  document: VideoDocument; projectId: string; player: RefObject<PlayerRef | null>; initialFrame: number; selected: string | null; guides: boolean;
  onSelect: (id: string | null) => void; onChange: (layer: VideoLayer) => void; onFiles: (files: File[]) => void; unlockedRatios: string[];
}) {
  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 360, height: 640 });
  const inputProps = useMemo(() => ({ document: doc, projectId }), [doc, projectId]);
  const scale = Math.min(size.width / doc.width, size.height / doc.height), w = doc.width * scale, h = doc.height * scale;
  useEffect(() => {
    const el = container.current; if (!el) return;
    const observer = new ResizeObserver(() => setSize({ width: Math.max(80, el.clientWidth - 48), height: Math.max(80, el.clientHeight - 48) }));
    observer.observe(el); return () => observer.disconnect();
  }, []);
  return <div ref={container} aria-label="영상 캔버스" className="relative flex min-h-[200px] min-w-0 flex-1 items-center justify-center overflow-hidden bg-muted/20 p-6" onClick={() => onSelect(null)}
    onDragEnter={e => { if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); dragDepth.current++; setDropping(true); }}
    onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
    onDragLeave={e => { e.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDropping(false); }}
    onDrop={e => { e.preventDefault(); e.stopPropagation(); dragDepth.current = 0; setDropping(false); const files = Array.from(e.dataTransfer.files); if (files.length) onFiles(files); }}>
    {dropping && <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-sky-500 bg-background/90"><p className="rounded-md bg-background px-4 py-3 text-sm font-medium shadow-sm">영상·이미지를 놓아 추가하세요</p></div>}
    <div className="relative shrink-0 shadow-lg" style={{ width: w, height: h }} onClick={e => e.stopPropagation()}>
      <Player ref={player} initialFrame={initialFrame} component={VideoComposition} inputProps={inputProps} compositionWidth={doc.width} compositionHeight={doc.height} fps={doc.fps}
        durationInFrames={videoDuration(doc)} controls={false} loop style={{ width: w, height: h }} clickToPlay={false} />
      <CanvasSelection document={doc} player={player} initialFrame={initialFrame} scale={scale} selected={selected} guides={guides} unlockedRatios={unlockedRatios} onSelect={onSelect} onChange={onChange} />
    </div>
  </div>;
}
