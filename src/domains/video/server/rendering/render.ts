import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { videoStore } from "@/domains/video/server/service";
import { videoDuration, type VideoSnapshot } from "@/domains/video/domain/model";
import { serializePreview } from "@/lib/media/preview-queue";
import { PreviewCache } from "@/lib/media/preview/cache";
import { serveRenderMedia } from "@/lib/media/rendering/http";
import { runRenderProcess, type RenderOptions } from "@/lib/media/rendering/process";
import { renderSourceKey } from "@/lib/media/rendering/source";

type Assets = Map<string, { bytes: Buffer; type: string }>;
const previews = new PreviewCache();
let bundle: { directory: string; key: string } | undefined;
let idle: ReturnType<typeof setTimeout> | undefined;
export function captureVideoAssets(snapshot: VideoSnapshot): Assets {
  const store = videoStore();
  return new Map([...new Set(snapshot.document.layers.flatMap(layer => "assetId" in layer ? [layer.assetId] : []))].map(id => {
    const asset = store.asset(snapshot.id, id); if (!asset) throw new Error("미디어 파일을 찾을 수 없습니다.");
    return [id, { bytes: asset.data, type: asset.type }];
  }));
}
export async function renderVideo(snapshot: VideoSnapshot, options: RenderOptions & { assets?: Assets } = {}) {
  return (await runRenderer(snapshot, undefined, 1, options))[0];
}
export async function renderVideoFrames(snapshot: VideoSnapshot, frames: number[], width = 540, options: RenderOptions = {}) {
  if (!frames.length || frames.length > 8 || frames.some(frame => !Number.isInteger(frame) || frame < 0 || frame >= videoDuration(snapshot.document)))
    throw new Error("영상 범위 안의 프레임을 1~8개 지정해 주세요.");
  return runRenderer(snapshot, frames, Math.min(1, width / snapshot.document.width), options);
}
async function runRenderer(snapshot: VideoSnapshot, frames: number[] | undefined, scale: number, options: RenderOptions & { assets?: Assets }) {
  const assets = options.assets ?? (!frames ? captureVideoAssets(snapshot) : undefined);
  return serializePreview(async () => {
    clearTimeout(idle); options.signal?.throwIfAborted();
    const key = await renderSourceKey(["src/domains/video/remotion", "src/domains/video/domain", "scripts/video/render.mts"]);
    if (bundle?.key !== key) {
      if (bundle) await rm(bundle.directory, { recursive: true, force: true });
      bundle = { key, directory: await mkdtemp(path.join(tmpdir(), "content-studio-video-bundle-")) };
    }
    const cacheKey = (frame: number) => JSON.stringify([key, snapshot.id, snapshot.tabId, snapshot.revision, frame, scale]);
    let directory: string | undefined;
    let media: Awaited<ReturnType<typeof serveRenderMedia>> | undefined;
    try {
      const unique = frames ? [...new Set(frames)] : undefined;
      const results = new Map(unique?.flatMap(frame => { const bytes = previews.get(cacheKey(frame)); return bytes ? [[frame, bytes] as const] : []; }));
      const missing = unique?.filter(frame => !results.has(frame));
      if (!frames || missing?.length) {
        directory = await mkdtemp(path.join(tmpdir(), "content-studio-render-"));
        media = await serveRenderMedia(assets ?? captureVideoAssets(snapshot));
        const propsFile = path.join(directory, "props.json"), output = path.join(directory, "video.mp4");
        if (frames) await mkdir(output);
        await writeFile(propsFile, JSON.stringify({ document: snapshot.document, projectId: snapshot.id, sources: media.sources }));
        await runRenderProcess(path.resolve("scripts/video/render.mts"), [propsFile, bundle.directory, output,
          ...(frames ? [JSON.stringify(missing), String(scale)] : [])], options);
        if (!frames) return [await readFile(output)];
        for (const [index, frame] of missing!.entries()) {
          const bytes = await readFile(path.join(output, `${index}.png`)); results.set(frame, bytes); previews.set(cacheKey(frame), bytes);
        }
      }
      options.signal?.throwIfAborted();
      return frames!.map(frame => results.get(frame)!);
    } finally {
      await media?.close();
      if (directory) await rm(directory, { recursive: true, force: true });
      const current = bundle;
      idle = setTimeout(() => { if (bundle === current) bundle = undefined; void rm(current!.directory, { recursive: true, force: true }); }, 30_000); idle.unref();
    }
  }, options.signal);
}
