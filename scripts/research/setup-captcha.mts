import { createHash } from "node:crypto";
import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import JSZip from "jszip";
import release from "./captcha-release.json";
import { researchRuntimeDirectory } from "../../src/lib/research/runtime";

const platform = ({ darwin: "mac", linux: "linux", win32: "win" } as Record<string, string>)[process.platform];
if (!platform || !["arm64", "x64"].includes(process.arch)) throw new Error("The local CAPTCHA engine has no pinned release for this platform.");
const binaryName = `captcha-bypass-cli-${platform}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`;
const directory = join(researchRuntimeDirectory(), "captcha");
await mkdir(directory, { recursive: true });
async function download(name: string) {
  const asset = (release.assets as Record<string, { url: string; sha256: string }>)[name];
  if (!asset) throw new Error("Missing pinned asset.");
  console.log(`Downloading ${release.version} ${name}...`);
  const response = await fetch(asset.url, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error(`Asset download failed (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error("Asset checksum does not match the pinned release.");
  return bytes;
}
const binary = await download(binaryName);
const archive = await download("models.zip");
const zip = await JSZip.loadAsync(archive);
for (const entry of Object.values(zip.files)) {
  if (entry.dir) continue;
  const destination = resolve(directory, entry.name);
  if (!destination.startsWith(directory + sep)) throw new Error("Unsafe model archive path.");
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, await entry.async("nodebuffer"));
}
const executable = join(directory, process.platform === "win32" ? "captcha-bypass.exe" : "captcha-bypass");
await writeFile(executable + ".part", binary);
await chmod(executable + ".part", 0o755);
await rename(executable + ".part", executable);
console.log("Local CAPTCHA recognition engine is ready. It runs only when the MCP solver tool is called.");
