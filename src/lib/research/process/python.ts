import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { researchRuntimeDirectory } from "../runtime";

type WorkerFailure = "setup_required" | "cancelled" | "timeout" | "output_limit" | "source_error";
export class PythonWorkerError extends Error {
  constructor(readonly reason: WorkerFailure) { super(`Research worker failed: ${reason}`); }
}
const MAX_OUTPUT_BYTES = 2_000_000;
const KILL_GRACE_MS = 1000;
export function researchPythonExecutable() {
  return process.env.CONTENT_STUDIO_RESEARCH_PYTHON ?? join(researchRuntimeDirectory(), "python",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
}

/** Bounded private IPC. Callers parse results and translate failures for their domain. */
export async function runPythonWorker(options: {
  script: string; args?: string[]; input?: string; signal?: AbortSignal; timeoutMs: number;
}): Promise<string> {
  const executable = researchPythonExecutable();
  if (options.signal?.aborted) throw new PythonWorkerError("cancelled");
  try { await access(executable); } catch { throw new PythonWorkerError("setup_required"); }
  return new Promise<string>((resolve, reject) => {
    const scriptPath = join(/* turbopackIgnore: true */ process.cwd(), options.script);
    const child = spawn(/* turbopackIgnore: true */ executable, [scriptPath, ...(options.args ?? [])],
      { stdio: ["pipe", "pipe", "pipe"], shell: false });
    let output = "", bytes = 0, settled = false;
    let killTimer: NodeJS.Timeout | undefined;
    const finish = (reason?: WorkerFailure) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      if (!reason) { resolve(output); return; }
      child.kill();
      killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS); killTimer.unref();
      reject(new PythonWorkerError(reason));
    };
    const cancel = () => finish("cancelled");
    const timer = setTimeout(() => finish("timeout"), options.timeoutMs); timer.unref();
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (settled) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_OUTPUT_BYTES) { finish("output_limit"); return; }
      output += chunk;
    });
    child.stderr.resume(); // Diagnostics may contain credentials; never expose them.
    child.stdin.once("error", () => finish("source_error"));
    child.once("error", () => finish("setup_required"));
    child.once("close", code => { clearTimeout(killTimer); finish(code === 0 ? undefined : "source_error"); });
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    else child.stdin.end(options.input);
  });
}
