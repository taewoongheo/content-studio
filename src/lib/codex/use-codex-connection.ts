"use client";

import { useEffect, useState } from "react";
import {
  selectEconomicalModel,
  type CodexModel,
} from "./connection/models/model-selection";
import type { CodexConnection } from "./transport/types";

export function useCodexConnection() {
  const [connection, setConnection] = useState<CodexConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [actionError, setActionError] = useState("");
  const [models, setModels] = useState<CodexModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsError, setModelsError] = useState("");

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

  useEffect(() => {
    if (connection?.status !== "connected") return;
    const abort = new AbortController();
    void fetch("/api/codex/models", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Model request failed");
        return (await response.json()) as CodexModel[];
      })
      .then((availableModels) => {
        setModels(availableModels);
        setSelectedModel((current) =>
          availableModels.some((model) => model.model === current)
            ? current
            : (selectEconomicalModel(availableModels)?.model ?? ""),
        );
        setModelsError("");
      })
      .catch(() => {
        if (abort.signal.aborted) return;
        setModelsError("사용 가능한 모델을 불러오지 못했습니다.");
      });
    return () => abort.abort();
  }, [connection?.status]);

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

  function selectModel(model: string) {
    if (models.some((item) => item.model === model)) setSelectedModel(model);
  }

  return {
    connection,
    busy,
    requestError: streamError || actionError,
    models,
    selectedModel,
    modelsError,
    selectModel,
    act,
  };
}

export type CodexConnectionController = ReturnType<typeof useCodexConnection>;
