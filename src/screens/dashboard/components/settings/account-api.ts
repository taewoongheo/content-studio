import type { AccountAction, AccountPlatform, AccountStatus } from "@/lib/research/accounts/types";

export async function requestResearchAccounts(signal: AbortSignal, mutation?: { platform: AccountPlatform; action: AccountAction }) {
  const response = await fetch("/api/research/accounts", mutation ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mutation), signal,
  } : { cache: "no-store", signal });
  const body = await response.json() as { accounts?: AccountStatus[]; error?: string };
  if (!response.ok || !body.accounts) throw new Error(body.error ?? "연결 상태를 불러오지 못했습니다.");
  return body.accounts;
}
