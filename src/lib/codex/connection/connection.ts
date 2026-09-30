import { getCodexCommand } from "../transport/command";
import {
  CodexJsonRpcTransport,
  type CodexTransportFailure,
} from "../transport/transport";
import type {
  CodexConnection,
  CodexJsonValue,
  CodexNotification,
  CodexUserInput,
  StructuredTurnResult,
} from "../transport/types";
import {
  visibleImageModels,
  type CodexModel,
} from "./models/model-selection";

const REQUEST_TIMEOUT_MS = 15_000;
const TURN_TIMEOUT_MS = 10 * 60_000;

type PendingTurn = {
  threadId: string;
  turnId: string;
  resolve: (result: StructuredTurnResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

type TurnCompletion = {
  status: "completed" | "interrupted" | "failed";
  message?: string;
};

type ConnectionOptions = {
  requestTimeoutMs?: number;
  turnTimeoutMs?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function turnKey(threadId: string, turnId: string) {
  return `${threadId}:${turnId}`;
}

function notificationIds(method: string, params: unknown) {
  const value = asRecord(params);
  if (!value) return {};
  const thread = asRecord(value.thread);
  const turn = asRecord(value.turn);
  return {
    threadId:
      typeof value.threadId === "string"
        ? value.threadId
        : method === "thread/started" && typeof thread?.id === "string"
          ? thread.id
          : undefined,
    turnId:
      typeof value.turnId === "string"
        ? value.turnId
        : typeof turn?.id === "string"
          ? turn.id
          : undefined,
  };
}

export class CodexConnectionManager {
  private transport: CodexJsonRpcTransport | null = null;
  private connecting: Promise<CodexConnection> | null = null;
  private listeners = new Set<(state: CodexConnection) => void>();
  private notificationListeners = new Set<
    (notification: CodexNotification) => void
  >();
  private pendingTurns = new Map<string, PendingTurn>();
  private turnMessages = new Map<string, string>();
  private turnCompletions = new Map<string, TurnCompletion>();
  private readonly requestTimeoutMs: number;
  private readonly turnTimeoutMs: number;
  private state: CodexConnection = {
    status: "disconnected",
    message: "연결되지 않음",
  };

  constructor(options: ConnectionOptions = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
    this.turnTimeoutMs = options.turnTimeoutMs ?? TURN_TIMEOUT_MS;
  }

  snapshot(): CodexConnection {
    return { ...this.state };
  }

  subscribe(listener: (state: CodexConnection) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeNotifications(listener: (notification: CodexNotification) => void) {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
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
    if (this.transport) return Promise.resolve(this.snapshot());
    this.connecting = this.start().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async start(): Promise<CodexConnection> {
    this.updateState({ status: "connecting", message: "Codex에 연결하는 중…" });
    const { command, args } = getCodexCommand();
    const transport = new CodexJsonRpcTransport({
      command,
      args,
      requestTimeoutMs: this.requestTimeoutMs,
      onNotification: (method, params) => {
        this.handleNotification(method, params);
        if (method === "account/updated") {
          void this.readAccount().catch(() =>
            this.fail(
              transport,
              "로그인 상태를 확인하지 못했습니다. 다시 연결해 주세요.",
            ),
          );
        }
      },
      onFailure: (failure) => this.handleTransportFailure(transport, failure),
    });
    this.transport = transport;
    transport.start();
    try {
      await this.request("initialize", {
        clientInfo: {
          name: "content_studio",
          title: "Content Studio",
          version: "0.1.0",
        },
      });
      transport.notify("initialized");
      await this.readAccount();
    } catch {
      this.fail(
        transport,
        "Codex에 연결하지 못했습니다. CLI와 로그인 상태를 확인해 주세요.",
      );
    }
    return this.snapshot();
  }

  private async readAccount() {
    const result = await this.request<{
      account?: { type?: string } | null;
    }>("account/read", { refreshToken: false });
    if (result.account?.type === "chatgpt") {
      this.updateState({
        status: "connected",
        message: "ChatGPT 계정으로 연결됨",
      });
      return;
    }
    this.updateState({
      status: "login-required",
      message:
        "터미널에서 codex login으로 ChatGPT에 로그인한 후 다시 연결하세요. API 키 연결은 사용하지 않습니다.",
    });
  }

  async listModels() {
    const models: CodexModel[] = [];
    let cursor: string | null = null;
    do {
      const result: { data: CodexModel[]; nextCursor: string | null } =
        await this.request("model/list", {
          cursor,
          limit: 100,
          includeHidden: false,
        });
      models.push(...result.data);
      cursor = result.nextCursor;
    } while (cursor);
    return visibleImageModels(models);
  }

  async startThread(params: { cwd?: string; model?: string } = {}) {
    const result = await this.request<{ thread?: { id?: unknown } }>(
      "thread/start",
      {
        ...params,
        approvalPolicy: "never",
        sandbox: "read-only",
        ephemeral: true,
      },
    );
    if (typeof result.thread?.id !== "string")
      throw new Error("Codex가 유효한 thread ID를 반환하지 않았습니다.");
    return { threadId: result.thread.id };
  }

  async runStructuredTurn({
    threadId,
    input,
    outputSchema,
  }: {
    threadId: string;
    input: CodexUserInput[];
    outputSchema: CodexJsonValue;
  }): Promise<StructuredTurnResult> {
    const wireInput = input.map((item) =>
      item.type === "text" ? { ...item, text_elements: [] } : item,
    );
    const result = await this.request<{ turn?: { id?: unknown } }>(
      "turn/start",
      { threadId, input: wireInput, outputSchema },
    );
    if (typeof result.turn?.id !== "string")
      throw new Error("Codex가 유효한 turn ID를 반환하지 않았습니다.");
    const turnId = result.turn.id;
    const key = turnKey(threadId, turnId);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingTurns.delete(key);
        this.turnMessages.delete(key);
        this.turnCompletions.delete(key);
        resolve({
          status: "timed-out",
          threadId,
          turnId,
          message: "Codex 작업 시간이 초과되었습니다.",
        });
      }, this.turnTimeoutMs);
      timer.unref();
      this.pendingTurns.set(key, { threadId, turnId, resolve, timer });
      const completion = this.turnCompletions.get(key);
      if (completion) this.finishTurn(key, completion);
    });
  }

  private request<Result>(method: string, params: unknown): Promise<Result> {
    if (!this.transport) return Promise.reject(new Error("Disconnected"));
    return this.transport.request<Result>(method, params);
  }

  private handleNotification(method: string, params: unknown) {
    const ids = notificationIds(method, params);
    const notification = { method, params, ...ids };
    for (const listener of this.notificationListeners) listener(notification);
    if (!ids.threadId || !ids.turnId) return;
    const key = turnKey(ids.threadId, ids.turnId);
    const value = asRecord(params);
    if (method === "item/completed") {
      const item = asRecord(value?.item);
      if (
        item?.type === "agentMessage" &&
        typeof item.text === "string" &&
        (item.phase === "final_answer" || item.phase == null)
      ) {
        this.turnMessages.set(key, item.text);
      }
      return;
    }
    if (method !== "turn/completed") return;
    const turn = asRecord(value?.turn);
    if (
      turn?.status !== "completed" &&
      turn?.status !== "interrupted" &&
      turn?.status !== "failed"
    )
      return;
    const error = asRecord(turn.error);
    const completion: TurnCompletion = {
      status: turn.status,
      message: typeof error?.message === "string" ? error.message : undefined,
    };
    if (this.pendingTurns.has(key)) this.finishTurn(key, completion);
    else this.turnCompletions.set(key, completion);
  }

  private finishTurn(key: string, completion: TurnCompletion) {
    const pending = this.pendingTurns.get(key);
    if (!pending) {
      this.turnCompletions.set(key, completion);
      return;
    }
    clearTimeout(pending.timer);
    this.pendingTurns.delete(key);
    this.turnCompletions.delete(key);
    if (completion.status === "failed") {
      this.turnMessages.delete(key);
      pending.resolve({
        status: "failed",
        threadId: pending.threadId,
        turnId: pending.turnId,
        message: completion.message ?? "Codex 작업을 완료하지 못했습니다.",
      });
      return;
    }
    if (completion.status === "interrupted") {
      this.turnMessages.delete(key);
      pending.resolve({
        status: "interrupted",
        threadId: pending.threadId,
        turnId: pending.turnId,
        message: "Codex 작업이 중단되었습니다.",
      });
      return;
    }
    const message = this.turnMessages.get(key);
    this.turnMessages.delete(key);
    if (!message) {
      pending.resolve({
        status: "invalid-output",
        threadId: pending.threadId,
        turnId: pending.turnId,
        message: "Codex의 최종 응답을 찾을 수 없습니다.",
      });
      return;
    }
    try {
      pending.resolve({
        status: "completed",
        threadId: pending.threadId,
        turnId: pending.turnId,
        output: JSON.parse(message) as CodexJsonValue,
      });
    } catch {
      pending.resolve({
        status: "invalid-output",
        threadId: pending.threadId,
        turnId: pending.turnId,
        message: "Codex의 최종 응답이 유효한 JSON이 아닙니다.",
      });
    }
  }

  private stop() {
    const transport = this.transport;
    this.transport = null;
    transport?.stop();
    for (const pending of this.pendingTurns.values()) {
      clearTimeout(pending.timer);
      pending.resolve({
        status: "failed",
        threadId: pending.threadId,
        turnId: pending.turnId,
        message: "Codex 연결이 끊어졌습니다.",
      });
    }
    this.pendingTurns.clear();
    this.turnMessages.clear();
    this.turnCompletions.clear();
  }

  private handleTransportFailure(
    transport: CodexJsonRpcTransport,
    failure: CodexTransportFailure,
  ) {
    const messages: Record<CodexTransportFailure, string> = {
      "missing-executable":
        "Codex CLI를 찾을 수 없습니다. 설치 후 서버를 다시 시작해 주세요.",
      "spawn-failed":
        "Codex를 실행할 수 없습니다. 설치 상태를 확인해 주세요.",
      "connection-lost": "Codex 연결이 끊어졌습니다. 다시 연결해 주세요.",
      "process-exited": "Codex가 종료되었습니다. 다시 연결해 주세요.",
      "invalid-message":
        "Codex 응답을 읽지 못했습니다. CLI 버전을 확인해 주세요.",
    };
    this.fail(transport, messages[failure]);
  }

  private fail(transport: CodexJsonRpcTransport, message: string) {
    if (this.transport !== transport) return;
    this.stop();
    this.updateState({ status: "error", message });
  }

  async disconnect(): Promise<CodexConnection> {
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
