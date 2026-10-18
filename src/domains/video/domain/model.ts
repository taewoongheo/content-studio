import { z } from "zod";

const color = z.string().regex(/^#[\da-f]{6}$/i);
const frame = z.number().int().min(0).max(108000);
const base = {
  id: z.string().uuid(), name: z.string().trim().min(1).max(120),
  from: frame, duration: z.number().int().min(1).max(108000),
  x: z.number().min(-7680).max(7680), y: z.number().min(-7680).max(7680),
  width: z.number().min(1).max(7680), height: z.number().min(1).max(7680),
  rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1),
};
const media = {
  assetId: z.string().uuid(), sourceFrames: z.number().int().min(1).max(1080000),
  trimStart: frame, trimEnd: z.number().int().min(1).max(1080000), volume: z.number().min(0).max(1), loop: z.boolean(),
};
export const layerSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("video"), ...media, sequence: z.boolean().optional(), sequenceIndex: z.number().min(0).max(1000).optional(), sequenceStart: frame.optional(), fit: z.enum(["cover", "contain"]), cropX: z.number().min(0).max(100), cropY: z.number().min(0).max(100) }),
  z.object({ ...base, kind: z.literal("audio"), ...media }),
  z.object({ ...base, kind: z.literal("image"), assetId: z.string().uuid(), fit: z.enum(["cover", "contain"]) }),
  z.object({ ...base, kind: z.literal("text"), text: z.string().max(10000), fontFamily: z.enum(["Inter", "Oswald", "Space Grotesk", "sans-serif"]), fontSize: z.number().min(8).max(400), fontWeight: z.number().int().min(100).max(900), italic: z.boolean(), align: z.enum(["left", "center", "right"]), color, backgroundColor: color, backgroundOpacity: z.number().min(0).max(1), borderRadius: z.number().min(0).max(100), fadeIn: frame, lineHeight: z.number().min(0.5).max(3).optional(), paddingX: z.number().min(0).max(400).optional(), paddingY: z.number().min(0).max(400).optional() }),
  z.object({ ...base, kind: z.literal("shape"), shape: z.enum(["rectangle", "ellipse", "triangle", "line"]), color, strokeColor: color, strokeWidth: z.number().min(0).max(100), borderRadius: z.number().min(0).max(100) }),
]);
export const videoDocumentSchema = z.object({
  type: z.literal("content-studio-video"), version: z.literal(1),
  width: z.number().int().min(64).max(3840).refine(n => n % 2 === 0),
  height: z.number().int().min(64).max(3840).refine(n => n % 2 === 0),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]),
  backgroundColor: color, duration: z.number().int().min(1).max(108000),
  layers: z.array(layerSchema).max(200),
}).superRefine((doc, ctx) => {
  const ids = new Set<string>();
  doc.layers.forEach((layer, i) => {
    if (ids.has(layer.id)) ctx.addIssue({ code: "custom", path: ["layers", i], message: "중복 요소 ID입니다." });
    ids.add(layer.id);
    if (layer.from + layer.duration > 108000) ctx.addIssue({ code: "custom", path: ["layers", i], message: "최대 영상 길이를 초과했습니다." });
    if ((layer.kind === "video" || layer.kind === "audio") &&
      (layer.trimStart >= layer.trimEnd || layer.trimEnd > layer.sourceFrames || (!layer.loop && layer.duration > layer.trimEnd - layer.trimStart)))
      ctx.addIssue({ code: "custom", path: ["layers", i], message: "미디어 재생 구간을 확인해 주세요." });
  });
});
export type VideoLayer = z.infer<typeof layerSchema>;
export type VideoDocument = z.infer<typeof videoDocumentSchema>;
export type VideoAsset = { id: string; name: string; type: string; size: number };
export type VideoSnapshot = { id: string; tabId: string; name: string; revision: number; document: VideoDocument; assets: VideoAsset[]; canUndo: boolean; canRedo: boolean };
export type VideoSummary = { id: string; name: string; projectType: "video"; revision: number; tabId?: string | null; width: number; height: number; fps: number; duration: number; updatedAt: string };
export const newVideoDocument = (): VideoDocument => ({ type: "content-studio-video", version: 1, width: 1080, height: 1920, fps: 30, backgroundColor: "#FFFFFF", duration: 150, layers: [] });
export const videoDuration = (doc: VideoDocument) => Math.max(doc.duration, ...doc.layers.map(l => l.from + l.duration));
export const mediaUrl = (projectId: string, assetId: string) => `/api/video-projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`;
export function createLayer(kind: VideoLayer["kind"], doc: VideoDocument, from = 0): VideoLayer {
  const channels = doc.backgroundColor.slice(1).match(/../g)!.map(channel => parseInt(channel, 16));
  const foreground = channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114 > 160 ? "#111111" : "#FFFFFF";
  const base = { id: crypto.randomUUID(), name: kind === "text" ? "텍스트" : "도형", from, duration: Math.max(1, videoDuration(doc) - from), x: 90, y: 160, width: doc.width - 180, height: 180, rotation: 0, opacity: 1 };
  if (kind === "text") return { ...base, kind, text: "텍스트를 입력하세요", fontFamily: "Inter", fontSize: 64, fontWeight: 700, italic: false, align: "center", color: foreground, backgroundColor: "#000000", backgroundOpacity: 0, borderRadius: 0, fadeIn: 0 };
  if (kind === "shape") return { ...base, kind, width: 320, height: 240, shape: "rectangle", color: foreground, strokeColor: foreground, strokeWidth: 0, borderRadius: 0 };
  throw new Error("미디어 파일을 선택해 주세요.");
}
export function splitVideoLayer(layer: VideoLayer, at: number): VideoLayer[] | null {
  if (layer.kind !== "video" || at <= layer.from || at >= layer.from + layer.duration) return null;
  const offset = at - layer.from;
  if (layer.loop) return null;
  return [{ ...layer, duration: offset, trimEnd: layer.trimStart + offset }, { ...layer, id: crypto.randomUUID(), name: `${layer.name.slice(0, 110)} B`, ...(layer.sequence ? { sequenceIndex: (layer.sequenceIndex ?? 0) + 0.5, sequenceStart: 0 } : {}), from: at, duration: layer.duration - offset, trimStart: layer.trimStart + offset }];
}

/** Visual stacking never determines playback order after a document enters the editor. */
export function reflowSequence(doc: VideoDocument): VideoDocument {
  const sequence = doc.layers.filter(l => l.kind === "video" && l.sequence)
    .map((layer, index) => ({ layer, index: layer.kind === "video" ? layer.sequenceIndex ?? index : index }))
    .sort((a, b) => a.index - b.index);
  let from = 0;
  const timing = new Map(sequence.map(({ layer }, sequenceIndex) => {
    from = Math.max(from, layer.kind === "video" ? layer.sequenceStart ?? 0 : 0);
    const value = { from, sequenceIndex }; from += layer.duration; return [layer.id, value];
  }));
  return { ...doc, layers: doc.layers.map(layer => timing.has(layer.id) ? { ...layer, ...timing.get(layer.id)! } : layer) };
}
export function reorderVideoLayers(doc: VideoDocument, activeId: string, overId: string): VideoDocument {
  const normalized = reflowSequence(doc);
  const frontToBack = [...normalized.layers].reverse();
  const from = frontToBack.findIndex(l => l.id === activeId), to = frontToBack.findIndex(l => l.id === overId);
  if (from < 0 || to < 0 || from === to) return normalized;
  const [layer] = frontToBack.splice(from, 1); frontToBack.splice(to, 0, layer);
  return { ...normalized, layers: frontToBack.reverse() };
}

export const appendFrame = (doc: VideoDocument) => doc.layers.length ? videoDuration(doc) : 0;
