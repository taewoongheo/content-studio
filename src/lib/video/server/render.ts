import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { videoStore } from "./service";
import { videoDuration, type VideoSnapshot } from "../domain/model";
let rendering = false;
export async function renderVideo(snapshot: VideoSnapshot) {
  return (await runRenderer(snapshot))[0];
}
export async function renderVideoFrames(snapshot: VideoSnapshot, frames: number[], width = 540) {
  if (!frames.length || frames.length > 8 || frames.some(frame => !Number.isInteger(frame) || frame < 0 || frame >= videoDuration(snapshot.document)))
    throw new Error("영상 범위 안의 프레임을 1~8개 지정해 주세요.");
  return runRenderer(snapshot, frames, Math.min(1, width / snapshot.document.width));
}
async function runRenderer(snapshot: VideoSnapshot, frames?: number[], scale = 1) {
  if (rendering) throw new Error("다른 영상을 내보내는 중입니다. 완료 후 다시 시도해 주세요.");
  rendering = true;
  let directory: string | undefined;
  try {
    directory = await mkdtemp(path.join(tmpdir(), "content-studio-render-"));
    const publicDir = path.join(directory, "public"), mediaDir = path.join(publicDir, "render-media");
    await mkdir(mediaDir, { recursive: true });
    const sources: Record<string, string> = {};
    const ids = new Set(snapshot.document.layers.flatMap(l => "assetId" in l ? [l.assetId] : []));
    const extensions: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
    for (const id of ids) {
      const asset = videoStore().asset(snapshot.id, id);
      if (!asset) throw new Error("미디어 파일을 찾을 수 없습니다.");
      const name = `${id}.${extensions[asset.type] ?? "bin"}`;
      await writeFile(path.join(mediaDir, name), asset.data); sources[id] = `/render-media/${name}`;
    }
    const propsFile = path.join(directory, "props.json"), output = path.join(directory, "video.mp4");
    if (frames) await mkdir(output);
    await writeFile(propsFile, JSON.stringify({ document: snapshot.document, projectId: snapshot.id, sources }));
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", path.resolve("scripts/video/render.mts"), propsFile, publicDir, output, ...(frames ? [JSON.stringify(frames), String(scale)] : [])], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
      let log = "";
      child.stdout.on("data", chunk => { log = (log + chunk).slice(-4000); });
      child.stderr.on("data", chunk => { log = (log + chunk).slice(-4000); });
      const timer = setTimeout(() => { child.kill("SIGKILL"); }, 15 * 60 * 1000);
      child.on("error", error => { clearTimeout(timer); reject(error); });
      child.on("close", code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`MP4 렌더링에 실패했습니다: ${log.slice(-1500)}`)); });
    });
    return frames ? await Promise.all(frames.map((_, index) => readFile(path.join(output, `${index}.png`)))) : [await readFile(output)];
  } finally { if (directory) await rm(directory, { recursive: true, force: true }); rendering = false; }
}
