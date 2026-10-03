"use client";

import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { CodexConnectionController } from "@/lib/codex/use-codex-connection";

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

export function CodexConnection({
  controller,
}: {
  controller: CodexConnectionController;
}) {
  const {
    connection,
    busy,
    requestError,
    models,
    selectedModel,
    modelsError,
    selectModel,
    act,
  } = controller;

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
      {status === "connected" && (
        <div className="grid gap-2 border-t pt-3">
          <label htmlFor="codex-model" className="text-xs font-medium">
            모델
          </label>
          <NativeSelect
            id="codex-model"
            value={selectedModel}
            disabled={models.length === 0}
            className="w-full"
            aria-describedby="codex-model-description"
            onChange={(event) => selectModel(event.target.value)}
          >
            {models.length === 0 && (
              <NativeSelectOption value="">불러오는 중…</NativeSelectOption>
            )}
            {models.map((model) => (
              <NativeSelectOption key={model.id} value={model.model}>
                {model.displayName}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p
            id="codex-model-description"
            className="text-xs leading-5 text-muted-foreground"
          >
            {modelsError ||
              models.find((model) => model.model === selectedModel)
                ?.description ||
              "이미지 입력을 지원하는 모델을 불러옵니다."}
          </p>
        </div>
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
