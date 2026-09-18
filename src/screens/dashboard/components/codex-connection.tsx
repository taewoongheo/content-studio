"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CodexConnection as Connection } from "@/lib/codex/types";

const labels = {
  disconnected: "연결 안 됨",
  connecting: "연결 중",
  connected: "연결됨",
  "login-required": "로그인 필요",
  error: "연결 오류",
};
const dots = {
  disconnected: "bg-muted-foreground/40",
  connecting: "bg-amber-500",
  connected: "bg-emerald-500",
  "login-required": "bg-amber-500",
  error: "bg-destructive",
};

async function readResponse(response: Response): Promise<Connection> {
  if (!response.ok) throw new Error("Connection request failed");
  return response.json();
}

export function CodexConnection() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const state = await readResponse(
          await fetch("/api/codex/connection", {
            cache: "no-store",
            signal: controller.signal,
          }),
        );
        if (!controller.signal.aborted) {
          setConnection(state);
          setRequestError("");
        }
      } catch {
        if (!controller.signal.aborted)
          setRequestError("로컬 서버와 연결할 수 없습니다.");
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 5000);
      }
    }
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [busy]);

  async function act(action: "connect" | "disconnect" | "reconnect") {
    setBusy(true);
    setRequestError("");
    try {
      const state = await readResponse(
        await fetch("/api/codex/connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }),
      );
      setConnection(state);
    } catch {
      setRequestError(
        "요청을 완료하지 못했습니다. 로컬 서버 상태를 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  const status = connection?.status;
  const canDisconnect = status === "connected" || status === "login-required";
  return (
    <section
      aria-label="Codex 연결"
      className="grid gap-3 rounded-lg bg-surface-subtle p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Codex</span>
        <span
          role="status"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${requestError ? dots.error : status ? dots[status] : dots.disconnected}`}
          />
          {busy
            ? "처리 중…"
            : requestError
              ? "상태 확인 불가"
              : status
                ? labels[status]
                : "확인 중…"}
        </span>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {connection?.message || "로컬 Codex의 연결 상태를 확인합니다."}
      </p>
      {requestError && (
        <p role="alert" className="text-xs leading-5 text-destructive">
          {requestError}
        </p>
      )}
      <div className="flex gap-2">
        {status !== "connected" && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 flex-1"
            disabled={busy || status === "connecting"}
            onClick={() =>
              void act(status === "login-required" ? "reconnect" : "connect")
            }
          >
            {status === "login-required" || status === "error"
              ? "다시 연결"
              : "연결"}
          </Button>
        )}
        {canDisconnect && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 flex-1"
            disabled={busy}
            onClick={() => void act("disconnect")}
          >
            연결 해제
          </Button>
        )}
      </div>
    </section>
  );
}
