"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountPlatform, AccountStatus } from "@/lib/research/accounts/types";
type Action = "login" | "finish" | "cancel" | "disconnect" | "import_safari";
export function useResearchAccounts() {
  const [accounts, setAccounts] = useState<AccountStatus[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<AccountPlatform | null>(null);
  const [busyAction, setBusyAction] = useState<Action | null>(null);
  const controller = useRef<AbortController | null>(null);
  const refreshing = useRef<AbortSignal | null>(null), mutating = useRef(false), version = useRef(0);
  const update = useCallback(async (response: Response, signal: AbortSignal, expectedVersion: number) => {
    const body = await response.json() as { accounts?: AccountStatus[]; error?: string };
    if (!response.ok || !body.accounts) throw new Error(body.error ?? "연결 상태를 불러오지 못했습니다.");
    if (!signal.aborted && expectedVersion === version.current) { setAccounts(body.accounts); setError(""); }
  }, []);
  const refresh = useCallback(async () => {
    const signal = controller.current?.signal, revision = version.current;
    if (!signal || signal.aborted || (refreshing.current && !refreshing.current.aborted) || mutating.current || document.visibilityState === "hidden") return;
    refreshing.current = signal;
    try { await update(await fetch("/api/research/accounts", { cache: "no-store", signal }), signal, revision); }
    catch (cause) { if (!signal.aborted && revision === version.current) setError(cause instanceof Error ? cause.message : "연결 상태를 불러오지 못했습니다."); }
    finally {
      // A cancelled effect must not clear the replacement effect's active request.
      if (refreshing.current === signal) refreshing.current = null;
    }
  }, [update]);
  useEffect(() => {
    const lifetime = new AbortController(); controller.current = lifetime;
    void refresh(); const timer = setInterval(() => void refresh(), 15_000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { lifetime.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);
  async function act(platform: AccountPlatform, action: Action) {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || mutating.current) return;
    mutating.current = true; const revision = ++version.current;
    setBusy(platform); setBusyAction(action); setError("");
    try { await update(await fetch("/api/research/accounts", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, action }), signal }), signal, revision); }
    catch (cause) { if (!signal.aborted) setError(cause instanceof Error ? cause.message : "계정 연결에 실패했습니다."); }
    finally { mutating.current = false; if (!signal.aborted) { setBusy(null); setBusyAction(null); } }
  }
  return { accounts, error, busy, busyAction, act, refresh };
}
