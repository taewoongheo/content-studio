"use client";
import { useEffect, useRef, useState } from "react";
import { assistantRequest as request } from "@/domains/workspace/assistant/client/api";
import type { AssistantSelection, AssistantState, AssistantTarget } from "@/domains/workspace/assistant/model";

export type AssistantControllerProps = {
  target: AssistantTarget; selection: AssistantSelection | (() => AssistantSelection);
  beforeStart: () => Promise<boolean>; onSettled: () => Promise<unknown>; onBusy: (busy: boolean) => void;
};
export function useAssistantController({ target, selection, beforeStart, onSettled, onBusy }: AssistantControllerProps) {
  const [status, setStatus] = useState<AssistantState | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const callbacks = useRef({ beforeStart, onSettled, onBusy });
  const latest = useRef({ target, selection });
  const submitted = useRef(false), settled = useRef("");
  const generation = useRef(0);
  useEffect(() => { callbacks.current = { beforeStart, onSettled, onBusy }; latest.current = { target, selection }; });
  const running = sending || status?.state === "running";
  useEffect(() => { callbacks.current.onBusy(running); }, [running]);
  const { projectId, tabId, projectType } = target;
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const version = generation.current;
        const next = await request<AssistantState>({ projectId, tabId, projectType });
        if (disposed || version !== generation.current || submitted.current) return;
        setStatus(next);
        if (next.requestId && next.state !== "running" && next.requestId !== settled.current) {
          settled.current = next.requestId;
          await callbacks.current.onSettled();
        }
      } catch (cause) { if (!disposed) setError(cause instanceof Error ? cause.message : "AI 상태 조회 실패"); }
      finally { if (!disposed) timer = setTimeout(() => void poll(), 1000); }
    }
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [projectId, tabId, projectType]);
  async function send(text: string) {
    if (!text.trim() || running || submitted.current) return;
    submitted.current = true; generation.current++; setSending(true); setError("");
    try {
      if (!await callbacks.current.beforeStart()) throw new Error("입력 중인 변경을 저장한 뒤 다시 실행해 주세요.");
      const next = await request<AssistantState>(latest.current.target, { action: "start", requestId: crypto.randomUUID(),
        message: text, selection: typeof latest.current.selection === "function" ? latest.current.selection() : latest.current.selection });
      setStatus(next); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI 실행 실패"); }
    finally { submitted.current = false; setSending(false); }
  }
  async function stop() {
    generation.current++;
    try { setStatus(await request<AssistantState>(target, { action: "stop" })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "중단 실패"); }
  }
  return { status, sending, running, error, send, stop };
}
