import { type VideoAsset, type VideoDocument, type VideoLayer, type VideoSnapshot } from "@/domains/video/domain/model";
import { videoEndpoint } from "@/domains/video/client/api";
import { createMediaLayer } from "@/domains/video/domain/media/layer";
export async function uploadMedia(snapshot: VideoSnapshot, file: File): Promise<VideoAsset> {
  const form = new FormData(); form.set("file", file); form.set("tabId", snapshot.tabId);
  const response = await fetch(`${videoEndpoint(snapshot.id)}/assets`, { method: "POST", body: form });
  const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "파일을 추가하지 못했습니다."); return data;
}
export async function mediaLayer(file: File, doc: VideoDocument, project: VideoSnapshot, from: number, overlay: boolean): Promise<VideoLayer> {
  const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : null;
  if (!kind) throw new Error("영상·오디오·이미지 파일을 선택해 주세요.");
  const info = await inspect(file, kind);
  const sourceFrames = Math.max(1, Math.round(info.duration * doc.fps));
  if (sourceFrames > 1080000) throw new Error("원본 영상이 너무 깁니다.");
  if (kind !== "image" && from + sourceFrames > 108000) throw new Error("미디어 전체를 추가하면 최대 영상 길이를 초과합니다.");
  const asset = await uploadMedia(project, file);
  return createMediaLayer({ kind, name: file.name, assetId: asset.id, info, document: doc, from, overlay });
}
async function inspect(file: File, kind: "video" | "audio" | "image"): Promise<{ duration: number; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    if (kind === "image") {
      const bitmap = await createImageBitmap(file); const result = { duration: 5, width: bitmap.width, height: bitmap.height }; bitmap.close(); return result;
    }
    return await new Promise((resolve, reject) => {
      const element = document.createElement(kind);
      const timer = setTimeout(() => { cleanup(); reject(new Error("파일 정보를 읽는 데 시간이 초과되었습니다.")); }, 15000);
      const cleanup = () => { clearTimeout(timer); element.removeAttribute("src"); element.load(); };
      element.preload = "metadata";
      element.onloadedmetadata = () => {
        const duration = element.duration;
        const result = { duration, width: element instanceof HTMLVideoElement ? element.videoWidth : 1, height: element instanceof HTMLVideoElement ? element.videoHeight : 1 };
        cleanup(); if (!Number.isFinite(duration) || duration <= 0) reject(new Error("재생 가능한 미디어 파일을 선택해 주세요.")); else resolve(result);
      };
      element.onerror = () => { cleanup(); reject(new Error("브라우저에서 읽을 수 없는 파일입니다. MP4(H.264) 또는 MP3/WAV를 사용해 주세요.")); };
      element.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}
