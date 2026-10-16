import { open } from "node:fs/promises";
import { basename, extname, isAbsolute } from "node:path";
import { createServer } from "node:http";
import { chromium } from "playwright";
import sharp from "sharp";
import type { MediaInfo } from "@/lib/video/domain/media/layer";

export type LocalVideoMedia = { bytes: Buffer; name: string; type: string; kind: "video" | "audio" | "image"; info: MediaInfo };
const types: Record<string, string> = {
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};
const maxBytes = 200 * 1024 * 1024;
export async function readLocalVideoMedia(localPath: string): Promise<LocalVideoMedia> {
  if (!isAbsolute(localPath)) throw new Error("localPath에는 절대 경로가 필요합니다.");
  const type = types[extname(localPath).toLowerCase()];
  if (!type) throw new Error("지원하는 영상·오디오·이미지 파일을 지정해 주세요.");
  const file = await open(localPath, "r");
  let bytes: Buffer;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > maxBytes) throw new Error("파일은 최대 200MB까지 추가할 수 있습니다.");
    const buffer = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < buffer.length) {
      const result = await file.read(buffer, size, buffer.length - size, null);
      if (!result.bytesRead) break;
      size += result.bytesRead;
    }
    if (size !== stat.size) throw new Error("읽는 중 파일 크기가 변경되었습니다. 다시 시도해 주세요.");
    bytes = buffer.subarray(0, size);
  } finally { await file.close(); }
  const kind = type.split("/")[0] as LocalVideoMedia["kind"];
  if (kind === "image") {
    const meta = await sharp(bytes).metadata();
    const expected = type === "image/jpeg" ? "jpeg" : type.slice(6);
    if (meta.format !== expected || !meta.width || !meta.height) throw new Error("이미지 형식을 확인해 주세요.");
    return { bytes, name: basename(localPath), type, kind, info: { duration: 5, width: meta.width, height: meta.height } };
  }
  // Inspect the same browser-supported codecs as the UI, without requiring a system ffprobe.
  const server = createServer((req, res) => {
    if (req.url !== "/media") { res.writeHead(200, { "Content-Type": "text/html" }); res.end("<!doctype html><body></body>"); return; }
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(bytes.length - 1, Number(range[2])) : bytes.length - 1;
    if (start > end || start >= bytes.length) { res.writeHead(416); res.end(); return; }
    res.writeHead(range ? 206 : 200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": end - start + 1,
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` } : {}) });
    res.end(bytes.subarray(start, end + 1));
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("미디어 검사 서버를 시작하지 못했습니다.");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${address.port}`);
      const info = await page.evaluate(({ kind }) => new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
        const element = document.createElement(kind);
        const timer = setTimeout(() => reject(new Error("미디어 정보를 읽는 시간이 초과되었습니다.")), 15000);
        element.preload = "metadata";
        element.onloadedmetadata = () => {
          clearTimeout(timer);
          const width = element instanceof HTMLVideoElement ? element.videoWidth : 1;
          const height = element instanceof HTMLVideoElement ? element.videoHeight : 1;
          if (!Number.isFinite(element.duration) || element.duration <= 0 || width <= 0 || height <= 0) reject(new Error("재생 가능한 미디어가 아닙니다."));
          else resolve({ duration: element.duration, width, height });
        };
        element.onerror = () => { clearTimeout(timer); reject(new Error("브라우저에서 읽을 수 없는 미디어입니다.")); };
        element.src = "/media";
      }), { kind });
      return { bytes, name: basename(localPath), type, kind, info };
    } finally { await browser.close(); }
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
