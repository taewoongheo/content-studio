import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type CodexTransportFailure =
  | "missing-executable"
  | "spawn-failed"
  | "connection-lost"
  | "process-exited"
  | "invalid-message";

type CodexTransportOptions = {
  command: string;
  args: string[];
  requestTimeoutMs: number;
  onNotification: (method: string, params: unknown) => void;
  onFailure: (failure: CodexTransportFailure) => void;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export class CodexJsonRpcTransport {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 0;
  private pending = new Map<number, PendingRequest>();

  constructor(private readonly options: CodexTransportOptions) {}

  start() {
    if (this.child) return;
    const child = spawn(
      /* turbopackIgnore: true */ this.options.command,
      this.options.args,
      { stdio: "pipe", shell: false },
    );
    this.child = child;
    const lines = createInterface({ input: child.stdout });
    child.stderr.resume();
    child.stdin.on("error", () => this.fail(child, "connection-lost"));
    child.on("error", (error: NodeJS.ErrnoException) =>
      this.fail(
        child,
        error.code === "ENOENT" ? "missing-executable" : "spawn-failed",
      ),
    );
    child.on("exit", () => {
      lines.close();
      this.fail(child, "process-exited");
    });
    lines.on("line", (line) => this.handleLine(child, line));
  }

  request<Result>(method: string, params: unknown): Promise<Result> {
    const child = this.child;
    if (!child) return Promise.reject(new Error("Disconnected"));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Codex request timed out"));
      }, this.options.requestTimeoutMs);
      timer.unref();
      this.pending.set(id, {
        resolve: (value) => resolve(value as Result),
        reject,
        timer,
      });
      child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }

  notify(method: string, params?: unknown) {
    const child = this.child;
    if (!child) throw new Error("Disconnected");
    child.stdin.write(
      JSON.stringify(params === undefined ? { method } : { method, params }) +
        "\n",
    );
  }

  stop() {
    const child = this.child;
    this.child = null;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("Disconnected"));
    }
    this.pending.clear();
    if (!child) return;
    child.stdin.end();
    child.kill("SIGTERM");
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }, 2000);
    timer.unref();
  }

  private handleLine(child: ChildProcessWithoutNullStreams, line: string) {
    if (this.child !== child) return;
    try {
      const envelope = asRecord(JSON.parse(line));
      if (!envelope) throw new Error("Invalid Codex message");
      if (typeof envelope.id === "number") {
        const request = this.pending.get(envelope.id);
        if (!request) return;
        clearTimeout(request.timer);
        this.pending.delete(envelope.id);
        if (envelope.error)
          request.reject(new Error("Codex 요청을 처리하지 못했습니다."));
        else request.resolve(envelope.result);
        return;
      }
      if (typeof envelope.method !== "string")
        throw new Error("Invalid Codex message");
      this.options.onNotification(envelope.method, envelope.params);
    } catch {
      this.fail(child, "invalid-message");
    }
  }

  private fail(
    child: ChildProcessWithoutNullStreams,
    failure: CodexTransportFailure,
  ) {
    if (this.child !== child) return;
    this.stop();
    this.options.onFailure(failure);
  }
}
