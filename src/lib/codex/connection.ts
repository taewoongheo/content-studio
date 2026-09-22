import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { getCodexCommand } from "./command";
import type { CodexConnection } from "./types";

const REQUEST_TIMEOUT_MS = 15_000;
type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

// Own only the stdio child started here; never stop the user's CLI or desktop app.
export class CodexConnectionManager {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 0;
  private connecting: Promise<CodexConnection> | null = null;
  private listeners = new Set<(state: CodexConnection) => void>();
  private state: CodexConnection = {
    status: "disconnected",
    message: "연결되지 않음",
  };

  snapshot(): CodexConnection {
    return { ...this.state };
  }

  subscribe(listener: (state: CodexConnection) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(state: CodexConnection) {
    if (
      this.state.status === state.status &&
      this.state.message === state.message
    )
      return;
    this.state = state;
    for (const listener of this.listeners) listener(this.snapshot());
  }

  connect(): Promise<CodexConnection> {
    if (this.connecting) return this.connecting;
    if (this.child) return Promise.resolve(this.snapshot());
    this.connecting = this.start().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async start(): Promise<CodexConnection> {
    this.updateState({ status: "connecting", message: "Codex에 연결하는 중…" });
    const { command, args } = getCodexCommand();
    const child = spawn(
      /* turbopackIgnore: true */ command,
      args,
      {
        stdio: "pipe",
        shell: false,
      },
    );
    this.child = child;
    const lines = createInterface({ input: child.stdout });
    child.stderr.resume();
    child.stdin.on("error", () =>
      this.fail(child, "Codex 연결이 끊어졌습니다. 다시 연결해 주세요."),
    );
    child.on("error", (error: NodeJS.ErrnoException) => {
      this.fail(
        child,
        error.code === "ENOENT"
          ? "Codex CLI를 찾을 수 없습니다. 설치 후 서버를 다시 시작해 주세요."
          : "Codex를 실행할 수 없습니다. 설치 상태를 확인해 주세요.",
      );
    });
    child.on("exit", () => {
      lines.close();
      this.fail(child, "Codex가 종료되었습니다. 다시 연결해 주세요.");
    });
    lines.on("line", (line) => {
      if (this.child !== child) return;
      try {
        const message = JSON.parse(line);
        if (typeof message.id === "number") {
          const pending = this.pending.get(message.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(message.id);
          if (message.error)
            pending.reject(new Error("Codex 요청을 처리하지 못했습니다."));
          else pending.resolve(message.result);
        } else if (message.method === "account/updated") {
          void this.readAccount().catch(() =>
            this.fail(
              child,
              "로그인 상태를 확인하지 못했습니다. 다시 연결해 주세요.",
            ),
          );
        }
      } catch {
        this.fail(
          child,
          "Codex 응답을 읽지 못했습니다. CLI 버전을 확인해 주세요.",
        );
      }
    });
    try {
      await this.request("initialize", {
        clientInfo: {
          name: "content_studio",
          title: "Content Studio",
          version: "0.1.0",
        },
      });
      child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
      await this.readAccount();
    } catch {
      this.fail(
        child,
        "Codex에 연결하지 못했습니다. CLI와 로그인 상태를 확인해 주세요.",
      );
    }
    return this.snapshot();
  }

  private async readAccount() {
    const result = (await this.request("account/read", {
      refreshToken: false,
    })) as { account?: { type?: string } | null };
    if (result.account?.type === "chatgpt") {
      this.updateState({
        status: "connected",
        message: "ChatGPT 계정으로 연결됨",
      });
    } else {
      this.updateState({
        status: "login-required",
        message:
          "터미널에서 codex login으로 ChatGPT에 로그인한 후 다시 연결하세요. API 키 연결은 사용하지 않습니다.",
      });
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const child = this.child;
    if (!child) return Promise.reject(new Error("Disconnected"));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Codex request timed out"));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }

  private stop() {
    const child = this.child;
    this.child = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Disconnected"));
    }
    this.pending.clear();
    if (child) {
      child.stdin.end();
      child.kill("SIGTERM");
      const timer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null)
          child.kill("SIGKILL");
      }, 2000);
      timer.unref();
    }
  }

  private fail(child: ChildProcessWithoutNullStreams, message: string) {
    if (this.child !== child) return;
    this.stop();
    this.updateState({ status: "error", message });
  }

  async disconnect(): Promise<CodexConnection> {
    // Wait for initialization so a late response cannot resurrect the connection.
    if (this.connecting) await this.connecting;
    this.stop();
    this.updateState({ status: "disconnected", message: "연결되지 않음" });
    return this.snapshot();
  }
}

const globalCodex = globalThis as typeof globalThis & {
  contentStudioCodex?: CodexConnectionManager;
};
export const codexConnection = (globalCodex.contentStudioCodex ??=
  new CodexConnectionManager());
