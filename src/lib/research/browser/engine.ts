import { spawn } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { researchRuntimeDirectory } from "../runtime";

let running = false;
export async function recognizeCaptcha(type: "slider" | "rotate", background: Buffer, piece: Buffer): Promise<unknown | null> {
  const executable = process.env.CONTENT_STUDIO_CAPTCHA_EXECUTABLE ?? join(researchRuntimeDirectory(), "captcha", process.platform === "win32" ? "captcha-bypass.exe" : "captcha-bypass");
  try { await access(executable); } catch { return null; }
  if (running) throw new Error("The local CAPTCHA recognition engine is busy. Try again after the current recognition finishes.");
  running = true;
  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), "studio-challenge-"));
    const bg = join(directory, "background.png"), thumb = join(directory, "piece.png");
    await writeFile(bg, background); await writeFile(thumb, piece);
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(/* turbopackIgnore: true */ executable, [type === "slider" ? "slide" : "rotate", "--type", type === "slider" ? "match" : "tiktok", "--bg", bg, "--thumb", thumb],
        { shell: false, cwd: dirname(executable), stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LOG_LEVEL: "none" } });
      let text = "", settled = false;
      const finish = (error?: Error) => {
        if (settled) return; settled = true; clearTimeout(timeout);
        if (error) { child.kill(); reject(error); } else resolve(text);
      };
      const timeout = setTimeout(() => finish(new Error("Local CAPTCHA recognition timed out.")), 30_000);
      child.stderr.resume();
      child.stdout.on("data", chunk => { text += chunk.toString(); if (text.length > 100_000) finish(new Error("Local CAPTCHA recognition exceeded its output limit.")); });
      child.once("error", () => finish(new Error("Local CAPTCHA engine could not start.")));
      child.once("close", code => finish(code === 0 ? undefined : new Error("Local CAPTCHA recognition failed.")));
    });
    const response = JSON.parse(output) as { code?: number; data?: unknown };
    if (response.code !== 0 || !response.data) throw new Error("The local CAPTCHA engine returned no recognition result.");
    return response.data;
  } finally { running = false; if (directory) await rm(directory, { recursive: true, force: true }); }
}
