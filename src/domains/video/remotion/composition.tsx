import { ensureVideoFont } from "@/domains/video/remotion/fonts";
import type { CSSProperties } from "react";
import { AbsoluteFill, Html5Video, OffthreadVideo, Html5Audio, Img, Loop, Sequence, getRemotionEnvironment, interpolate, staticFile, useCurrentFrame } from "remotion";
import { mediaUrl, type VideoDocument, type VideoLayer } from "@/domains/video/domain/model";
export type VideoCompositionProps = { document: VideoDocument; projectId: string; sources?: Record<string, string> };
function Layer({ layer: l, src }: { layer: VideoLayer; src?: string }) {
  const style: CSSProperties = { position: "absolute", left: l.x, top: l.y, width: l.width, height: l.height, transform: `rotate(${l.rotation}deg)`, opacity: l.opacity, overflow: "hidden" };
  if (l.kind === "audio") {
    const audio = <Html5Audio src={src!} trimBefore={l.trimStart} trimAfter={l.trimEnd} volume={l.volume} />;
    return l.loop ? <Loop durationInFrames={l.trimEnd - l.trimStart}>{audio}</Loop> : audio;
  }
  if (l.kind === "video") {
    const V = getRemotionEnvironment().isRendering ? OffthreadVideo : Html5Video;
    const video = <V src={src!} trimBefore={l.trimStart} trimAfter={l.trimEnd} volume={l.volume} style={{ width: "100%", height: "100%", objectFit: l.fit, objectPosition: `${l.cropX}% ${l.cropY}%` }} />;
    return <div style={style}>{l.loop ? <Loop durationInFrames={l.trimEnd - l.trimStart}>{video}</Loop> : video}</div>;
  }
  if (l.kind === "image") return <Img src={src!} style={{ ...style, objectFit: l.fit }} />;
  if (l.kind === "shape") return <svg style={style} viewBox={`0 0 ${l.width} ${l.height}`}>
    {l.shape === "ellipse" ? <ellipse cx={l.width / 2} cy={l.height / 2} rx={Math.max(0, (l.width - l.strokeWidth) / 2)} ry={Math.max(0, (l.height - l.strokeWidth) / 2)} fill={l.color} stroke={l.strokeColor} strokeWidth={l.strokeWidth} />
      : l.shape === "triangle" ? <polygon points={`${l.width / 2},${l.strokeWidth} ${l.width - l.strokeWidth},${l.height - l.strokeWidth} ${l.strokeWidth},${l.height - l.strokeWidth}`} fill={l.color} stroke={l.strokeColor} strokeWidth={l.strokeWidth} />
      : l.shape === "line" ? <line x1="0" y1={l.height / 2} x2={l.width} y2={l.height / 2} stroke={l.color} strokeWidth={Math.max(1, l.strokeWidth)} />
      : <rect x={l.strokeWidth / 2} y={l.strokeWidth / 2} width={Math.max(0, l.width - l.strokeWidth)} height={Math.max(0, l.height - l.strokeWidth)} rx={l.borderRadius} fill={l.color} stroke={l.strokeColor} strokeWidth={l.strokeWidth} />}
  </svg>;
  return <TextLayerView layer={l} style={style} />;
}
function TextLayerView({ layer: l, style }: { layer: Extract<VideoLayer, { kind: "text" }>; style: CSSProperties }) {
  const frame = useCurrentFrame();
  ensureVideoFont(l.fontFamily, l.italic);
  return <div style={{ ...style, whiteSpace: "pre-wrap", overflowWrap: "break-word", fontFamily: l.fontFamily === "sans-serif" ? "Geist, sans-serif" : l.fontFamily, fontSize: l.fontSize, fontWeight: l.fontWeight, fontStyle: l.italic ? "italic" : "normal", lineHeight: l.lineHeight ?? 1.15, color: l.color, textAlign: l.align, padding: `${l.paddingY ?? l.fontSize * 0.14}px ${l.paddingX ?? l.fontSize * 0.22}px`, boxSizing: "border-box", borderRadius: l.borderRadius, backgroundColor: `color-mix(in srgb, ${l.backgroundColor} ${l.backgroundOpacity * 100}%, transparent)`, opacity: l.opacity * (l.fadeIn > 0 ? interpolate(frame, [0, l.fadeIn], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }) : 1) }}>{l.text}</div>;
}
export function VideoComposition({ document, projectId, sources }: VideoCompositionProps) {
  return <AbsoluteFill style={{ backgroundColor: document.backgroundColor, overflow: "hidden" }}>
    {document.layers.map(layer => {
      const source = "assetId" in layer ? sources?.[layer.assetId] ?? mediaUrl(projectId, layer.assetId) : undefined;
      const src = source?.startsWith("/render-media/") ? staticFile(source.slice(1)) : source;
      return <Sequence key={layer.id} from={layer.from} durationInFrames={layer.duration} layout="none" name={layer.name}><Layer layer={layer} src={src} /></Sequence>;
    })}
  </AbsoluteFill>;
}
