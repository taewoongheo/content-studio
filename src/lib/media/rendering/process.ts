import { spawn } from "node:child_process";
export type RenderOptions = { signal?: AbortSignal; progress?: (progress: number, phase: string) => void };

/** Await process exit on cancellation so temporary media cannot be removed underneath Chromium. */
export function runRenderProcess(script: string, args: string[], options: RenderOptions = {}, timeoutMs = 15 * 60_000) {
  options.signal?.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", script, ...args], { cwd: process.cwd(), detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe", "ipc"] });
    let log = "", timedOut = false;
    let force: ReturnType<typeof setTimeout> | undefined;
    const terminate = (signal: NodeJS.Signals) => {
      try { if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal); else child.kill(signal); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    };
    const kill = () => { terminate("SIGTERM"); force ??= setTimeout(() => terminate("SIGKILL"), 2000); force.unref(); };
    const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
    const abort = () => kill();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const collect = (chunk: Buffer) => { log = (log + chunk).slice(-4000); };
    child.stdout?.on("data", collect); child.stderr?.on("data", collect);
    child.on("message", value => {
      const message = value as { progress?: unknown; phase?: unknown };
      if (typeof message?.progress === "number" && Number.isFinite(message.progress) && typeof message.phase === "string")
        options.progress?.(message.progress, message.phase);
    });
    const cleanup = () => { clearTimeout(timer); clearTimeout(force); options.signal?.removeEventListener("abort", abort); };
    child.once("error", error => { cleanup(); reject(error); });
    child.once("close", code => {
      cleanup();
      if (options.signal?.aborted) reject(options.signal.reason);
      else if (timedOut) reject(new Error("렌더링 제한 시간(15분)을 초과했습니다."));
      else if (code === 0) resolve();
      else reject(new Error(`렌더링에 실패했습니다: ${log.slice(-1500)}`));
    });
  });
}
