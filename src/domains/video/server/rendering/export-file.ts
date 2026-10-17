import { randomUUID } from "node:crypto";
import { open, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";

/** Reserve the destination early, but replace existing bytes only after a complete render. */
export async function writeVideoExport(outputPath: string, overwrite: boolean, render: () => Promise<Buffer>) {
  if (!isAbsolute(outputPath) || !outputPath.toLowerCase().endsWith(".mp4")) throw new Error("기존 폴더 안의 절대 MP4 경로를 지정해 주세요.");
  let reserved: { ino: number; dev: number } | undefined;
  let staged: string | undefined;
  let complete = false;
  try {
    try {
      const file = await open(outputPath, "wx", 0o600);
      try { const info = await file.stat(); reserved = { ino: info.ino, dev: info.dev }; }
      finally { await file.close(); }
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "EEXIST") throw cause;
      if (!overwrite) throw new Error("출력 파일이 이미 있습니다. 다른 경로를 지정하거나 overwrite=true로 요청해 주세요.");
      const existing = await open(outputPath, "r+");
      try { if (!(await existing.stat()).isFile()) throw new Error("출력 경로는 파일이어야 합니다."); }
      finally { await existing.close(); }
    }
    const temporary = join(dirname(outputPath), `.${basename(outputPath)}.${randomUUID()}.tmp`);
    const file = await open(temporary, "wx", 0o600);
    staged = temporary;
    let bytes: Buffer;
    try { bytes = await render(); await file.writeFile(bytes); }
    finally { await file.close(); }
    await rename(temporary, outputPath);
    complete = true;
    return bytes.length;
  } finally {
    if (staged) await unlink(staged).catch(cause => { if (cause.code !== "ENOENT") throw cause; });
    if (!complete && reserved) {
      const current = await stat(outputPath).catch(() => null);
      if (current?.ino === reserved.ino && current.dev === reserved.dev) await unlink(outputPath);
    }
  }
}
