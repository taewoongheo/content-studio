"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountAction, AccountPlatform, AccountStatus } from "@/lib/research/accounts/types";
import { requestResearchAccounts } from "./account-api";
const POLL_INTERVAL_MS = 15_000;
export function useResearchAccounts() {
  const [accounts, setAccounts] = useState<AccountStatus[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ platform: AccountPlatform; action: AccountAction } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const refreshing = useRef<AbortSignal | null>(null), mutating = useRef(false), version = useRef(0);
  const update = useCallback((next: AccountStatus[], signal: AbortSignal, expectedVersion: number) => {
    if (!signal.aborted && expectedVersion === version.current) { setAccounts(next); setError(""); }
  }, []);
  const refresh = useCallback(async () => {
    const signal = controller.current?.signal, revision = version.current;
    if (!signal || signal.aborted || (refreshing.current && !refreshing.current.aborted) || mutating.current || document.visibilityState === "hidden") return;
    refreshing.current = signal;
    try { update(await requestResearchAccounts(signal), signal, revision); }
    catch (cause) { if (!signal.aborted && revision === version.current) setError(cause instanceof Error ? cause.message : "연결 상태를 불러오지 못했습니다."); }
    finally {
      // A cancelled effect must not clear the replacement effect's active request.
      if (refreshing.current === signal) refreshing.current = null;
    }
  }, [update]);
  useEffect(() => {
    const lifetime = new AbortController(); controller.current = lifetime;
    void refresh(); const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { lifetime.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);
  async function act(platform: AccountPlatform, action: AccountAction) {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || mutating.current) return;
    mutating.current = true; const revision = ++version.current;
    setPending({ platform, action }); setError("");
    try { update(await requestResearchAccounts(signal, { platform, action }), signal, revision); }
    catch (cause) { if (!signal.aborted) setError(cause instanceof Error ? cause.message : "계정 연결에 실패했습니다."); }
    finally { mutating.current = false; if (!signal.aborted) setPending(null); }
  }
  return { accounts, error, busy: pending?.platform ?? null, busyAction: pending?.action ?? null, act, refresh };
}
