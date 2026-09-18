"use client";

import { useEffect, useState } from "react";
import type { CodexConnection } from "./types";

export function useCodexConnection() {
  const [connection, setConnection] = useState<CodexConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const events = new EventSource("/api/codex/connection");
    events.onmessage = (event) => {
      setConnection(JSON.parse(event.data) as CodexConnection);
      setStreamError("");
    };
    events.onerror = () => {
      setStreamError(
        "로컬 서버와 연결이 끊어졌습니다. 다시 연결하는 중입니다.",
      );
    };
    return () => events.close();
  }, []);

  async function act(action: "connect" | "disconnect" | "reconnect") {
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch("/api/codex/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error("Connection request failed");
      // State arrives on the event stream, including changes from other tabs.
    } catch {
      setActionError(
        "요청을 완료하지 못했습니다. 로컬 서버 상태를 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return { connection, busy, requestError: streamError || actionError, act };
}
