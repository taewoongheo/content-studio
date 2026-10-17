import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

/** Invalidate derived render caches when renderer code or project font configuration changes. */
export async function renderSourceKey(paths: string[]) {
  const files: string[] = [];
  async function visit(file: string): Promise<void> {
    const info = await stat(file);
    if (info.isDirectory()) await Promise.all((await readdir(file)).map(name => visit(join(file, name))));
    else if (/\.(tsx?|mts)$/.test(file) && !file.endsWith(".test.ts")) files.push(`${file}:${info.mtimeMs}:${info.size}`);
  }
  await Promise.all(paths.map(file => visit(join(process.cwd(), file))));
  return createHash("sha256").update(files.sort().join("\n")).digest("hex");
}
