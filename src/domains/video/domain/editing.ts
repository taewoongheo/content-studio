import type { VideoDocument, VideoLayer } from "@/domains/video/domain/model";

export type TimelineEdit = "move" | "start" | "end";

/** Moving a sequence clip changes playback order without changing visual stacking. */
export function updateVideoLayer(doc: VideoDocument, layer: VideoLayer): VideoDocument {
  const before = doc.layers.find(item => item.id === layer.id);
  let layers = doc.layers.map(item => item.id === layer.id ? layer : item);
  if (layer.kind === "video" && layer.sequence && before && layer.from !== before.from && layer.duration === before.duration) {
    const sequence = doc.layers
      .filter(item => item.kind === "video" && item.sequence && item.id !== layer.id)
      .sort((a, b) => a.from - b.from);
    const at = sequence.findIndex(item => layer.from < item.from + item.duration / 2);
    sequence.splice(at < 0 ? sequence.length : at, 0, layer);
    const order = new Map(sequence.map((item, index) => [item.id, index]));
    layers = layers.map(item => order.has(item.id) ? { ...item, sequenceIndex: order.get(item.id)! } : item);
  }
  return { ...doc, layers };
}

/** Delta is measured from the original pointer-down layer, in document frames. */
export function adjustLayerTiming(layer: VideoLayer, delta: number, mode: TimelineEdit): VideoLayer {
  if (mode === "move") {
    return { ...layer, from: Math.max(0, Math.min(108000 - layer.duration, layer.from + delta)) };
  }
  const media = (layer.kind === "video" || layer.kind === "audio") && !layer.loop;
  if (mode === "end") {
    const max = media ? Math.min(layer.sourceFrames - layer.trimStart, 108000 - layer.from) : 108000 - layer.from;
    const duration = Math.max(1, Math.min(max, layer.duration + delta));
    return { ...layer, duration, ...(media ? { trimEnd: layer.trimStart + duration } : {}) };
  }
  const minDelta = media
    ? -(layer.kind === "video" && layer.sequence ? layer.trimStart : Math.min(layer.from, layer.trimStart))
    : -layer.from;
  const amount = Math.max(minDelta, Math.min(layer.duration - 1, delta));
  return {
    ...layer,
    from: layer.from + amount,
    duration: layer.duration - amount,
    ...(media ? { trimStart: layer.trimStart + amount } : {}),
  };
}
