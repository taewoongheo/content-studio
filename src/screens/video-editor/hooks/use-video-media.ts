"use client";

import { useRef, useState, type RefObject } from "react";
import { appendFrame, type VideoDocument } from "@/domains/video/domain/model";
import { downloadBlob, renderVideoProject } from "@/domains/video/client/api";
import { mediaLayer } from "../media";
import type { useVideoProject } from "./use-video-project";

type MediaMode = "sequence" | "overlay" | "image" | "audio";
type VideoProject = Pick<ReturnType<typeof useVideoProject>, "current" | "change" | "flush" | "setError">;
const acceptedFiles: Record<MediaMode, string> = {
  sequence: "video/*",
  overlay: "video/*",
  image: "image/png,image/jpeg,image/webp",
  audio: "audio/*",
};

export function useVideoMedia({ project, document, pendingSeek, currentFrame, onSelect, run }: {
  project: VideoProject;
  document: RefObject<VideoDocument>;
  pendingSeek: RefObject<number | null>;
  currentFrame: () => number;
  onSelect: (id: string) => void;
  run: (work: () => Promise<void>) => Promise<void>;
}) {
  const files = useRef<HTMLInputElement>(null);
  const assetMode = useRef<MediaMode>("sequence");
  const currentExport = useRef<Promise<void> | null>(null);
  const [rendering, setRendering] = useState(false);

  async function addFiles(list: File[], mode = assetMode.current) {
    await run(async () => {
      for (const file of list) {
        const latest = document.current;
        const from = mode === "sequence" ? appendFrame(latest) : currentFrame();
        const layer = await mediaLayer(file, latest, project.current.current.snapshot, from, mode === "overlay" || mode === "image");
        const next = {
          ...document.current,
          duration: document.current.layers.length === 0 && mode === "sequence" ? 1 : document.current.duration,
          layers: [...document.current.layers, layer],
        };
        document.current = next;
        pendingSeek.current = layer.from;
        project.change(next);
        onSelect(layer.id);
      }
      if (!await project.flush()) throw new Error("미디어를 추가했지만 프로젝트를 저장하지 못했습니다. 저장을 다시 시도해 주세요.");
    });
  }

  function pick(mode: MediaMode, accept = acceptedFiles[mode]) {
    assetMode.current = mode;
    if (files.current) {
      files.current.accept = accept;
      files.current.click();
    }
  }

  async function exportMp4() {
    if (!await project.flush()) return;
    setRendering(true);
    project.setError("");
    const work = (async () => {
      const snapshot = project.current.current.snapshot;
      downloadBlob(await renderVideoProject(snapshot), `${snapshot.name}.mp4`);
    })();
    currentExport.current = work;
    try { await work; }
    catch (cause) { project.setError(cause instanceof Error ? cause.message : "내보내기에 실패했습니다."); }
    finally { currentExport.current = null; setRendering(false); }
  }

  return { files, addFiles, pick, exportMp4, rendering, waitForExport: async () => { await currentExport.current; } };
}
