import { rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const state = globalThis as typeof globalThis & { contentStudioRenderDirectories?: Set<string> };
if (!state.contentStudioRenderDirectories) {
  state.contentStudioRenderDirectories = new Set();
  process.once("exit", () => {
    for (const directory of state.contentStudioRenderDirectories!) {
      try { rmSync(directory, { recursive: true, force: true }); } catch { /* OS temp cleanup remains a fallback. */ }
    }
  });
}
const directories = state.contentStudioRenderDirectories;
export async function renderTemporaryDirectory(prefix: string) {
  const directory = await mkdtemp(join(tmpdir(), prefix)); directories.add(directory); return directory;
}
export async function removeRenderDirectory(directory: string) {
  await rm(directory, { recursive: true, force: true }); directories.delete(directory);
}
