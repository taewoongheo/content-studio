import type { VideoDocument } from "@/domains/video/domain/model";

/** Keep real time, including sequence anchors, when changing the document frame rate. */
export function changeVideoFps(doc: VideoDocument, fps: VideoDocument["fps"]): VideoDocument {
  if (fps === doc.fps) return doc;
  const ratio = fps / doc.fps;
  const frame = (value: number) => Math.round(value * ratio);
  return {
    ...doc, fps, duration: Math.max(1, frame(doc.duration)),
    layers: doc.layers.map(layer => {
      const timing = { from: frame(layer.from), duration: Math.max(1, frame(layer.duration)) };
      if (layer.kind === "video" || layer.kind === "audio") {
        const sourceFrames = Math.max(1, frame(layer.sourceFrames));
        const trimStart = Math.min(sourceFrames - 1, frame(layer.trimStart));
        const trimEnd = Math.min(sourceFrames, Math.max(trimStart + 1, frame(layer.trimEnd)));
        return { ...layer, ...timing, sourceFrames, trimStart, trimEnd,
          duration: layer.loop ? timing.duration : Math.min(timing.duration, trimEnd - trimStart),
          ...(layer.kind === "video" && layer.sequenceStart !== undefined ? { sequenceStart: frame(layer.sequenceStart) } : {}),
        };
      }
      return { ...layer, ...timing, ...(layer.kind === "text" ? { fadeIn: frame(layer.fadeIn) } : {}) };
    }),
  };
}
