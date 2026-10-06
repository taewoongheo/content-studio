import { spawn } from "node:child_process";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { researchRuntimeDirectory } from "../src/lib/research/runtime";

async function run(command: string, args: string[]) {
  const child = spawn(command, args, { stdio: "inherit", shell: false });
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Setup exited with ${code}`)));
  });
}
const directory = join(researchRuntimeDirectory(), "python");
await mkdir(directory, { recursive: true });
await run(process.env.CONTENT_STUDIO_PYTHON_BOOTSTRAP ?? "python3", ["-m", "venv", directory]);
await run(join(directory, process.platform === "win32" ? "Scripts/python.exe" : "bin/python"),
  ["-m", "pip", "install", "-r", join(process.cwd(), "workers/instagram/requirements.txt"),
    "-r", join(process.cwd(), "workers/accounts/requirements.txt")]);
console.log("Research Python environment is ready. Node.js starts the collector when needed.");
