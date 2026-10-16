import { type VideoDocument, type VideoLayer } from "../model";
export type MediaInfo = { duration: number; width: number; height: number };
export function createMediaLayer({ kind, name, assetId, info, document: doc, from, overlay, id = crypto.randomUUID() }: {
  kind: "video" | "audio" | "image"; name: string; assetId: string; info: MediaInfo;
  document: VideoDocument; from: number; overlay: boolean; id?: string;
}): VideoLayer {
  const sourceFrames = Math.max(1, Math.round(info.duration * doc.fps));
  if (sourceFrames > 1080000) throw new Error("원본 미디어가 너무 깁니다.");
  if (kind !== "image" && from + sourceFrames > 108000) throw new Error("미디어 전체를 추가하면 최대 영상 길이를 초과합니다.");
  const overlayWidth = Math.max(1, Math.min(doc.width * 0.4, doc.height * 0.5 * info.width / info.height));
  const base = {
    id, name: name.slice(0, 120), from, duration: kind === "image" ? doc.duration : sourceFrames,
    x: overlay ? Math.round(doc.width * 0.1) : 0, y: overlay ? Math.round(doc.height * 0.25) : 0,
    width: overlay ? Math.round(overlayWidth) : doc.width,
    height: overlay ? Math.max(1, Math.round(overlayWidth / (info.width / info.height))) : doc.height,
    rotation: 0, opacity: 1, assetId,
  };
  if (kind === "image") return { ...base, kind, fit: "contain" };
  const media = { ...base, sourceFrames, trimStart: 0, trimEnd: sourceFrames, volume: 1, loop: false };
  if (kind === "audio") return { ...media, kind };
  const sequence = doc.layers.filter(layer => layer.kind === "video" && layer.sequence);
  const sequenceEnd = sequence.reduce((end, layer) => Math.max(end, layer.from + layer.duration), 0);
  return { ...media, kind, sequence: !overlay,
    ...(!overlay ? { sequenceIndex: sequence.length, sequenceStart: from > sequenceEnd ? from : 0 } : {}),
    fit: overlay ? "contain" : "cover", cropX: 50, cropY: 50,
  };
}
