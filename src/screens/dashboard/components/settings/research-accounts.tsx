"use client";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { accountPlatforms, type AccountStatus } from "@/lib/research/accounts/types";
import type { useResearchAccounts } from "./use-research-accounts";
const names = { tiktok: "TikTok", instagram: "Instagram" };
const labels: Record<AccountStatus["status"], string> = { disconnected: "연결 안 됨", connected: "연결됨", login_required: "재로그인 필요", logging_in: "로그인 중" };
export function ResearchAccounts({ state }: { state: ReturnType<typeof useResearchAccounts> }) {
  return <div className="grid max-w-3xl gap-8">
    <header><h1 className="text-3xl font-semibold tracking-tight">설정</h1>
      <p className="mt-2 text-sm text-muted-foreground">리서치에 사용할 플랫폼 계정을 연결하세요.</p></header>
    <section aria-labelledby="research-accounts-heading">
      <h2 id="research-accounts-heading" className="border-b pb-4 text-base font-semibold">리서치 계정 연결</h2>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">로그인을 누르면 Safari가 열립니다. Safari에서 로그인한 뒤 이 화면에서 연결을 완료하세요. YouTube는 계정 연결 없이 사용할 수 있습니다.</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Safari에서 가져오려면 macOS의 Safari 기본 프로필에서 로그인한 뒤 Safari를 완전히 종료해 주세요. 선택한 플랫폼의 쿠키만 이 앱에 저장하며, 이후 검색은 Chromium에서 실행합니다.</p>
      {state.error && <p role="alert" className="mt-4 text-sm text-destructive">{state.error}</p>}
      {!state.accounts.length && !state.error && <p role="status" className="py-6 text-sm text-muted-foreground">연결 상태를 불러오는 중…</p>}
      <div className="mt-2 divide-y">
        {accountPlatforms.map(platform => {
          const account = state.accounts.find(item => item.platform === platform);
          if (!account) return null;
          const loggingIn = account.status === "logging_in";
          return <article key={platform} className="flex flex-wrap items-start justify-between gap-4 py-6">
            <div className="min-w-0"><h3 className="font-medium">{names[platform]}</h3>
              <p role="status" className={`mt-1 text-sm ${account.status === "login_required" ? "text-destructive" : "text-muted-foreground"}`}>{labels[account.status]}</p>
              {loggingIn && <p className="mt-2 text-sm text-muted-foreground">Safari 기본 프로필에서 로그인하고 Safari를 완전히 종료한 뒤 ‘로그인 완료’를 눌러주세요.</p>}
              {account.status === "login_required" && <p className="mt-2 text-sm text-muted-foreground">로그인 상태가 만료되었거나 플랫폼에서 재인증을 요청했습니다.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {loggingIn ? <>
                <Button disabled={state.busy !== null} onClick={() => void state.act(platform, "finish")}>로그인 완료</Button>
                <Button variant="outline" disabled={state.busy !== null} onClick={() => void state.act(platform, "cancel")}>취소</Button>
              </> : <>
                <Button variant="outline" disabled={state.busy !== null} onClick={() => void state.act(platform, "login")}>
                  {state.busy === platform && state.busyAction === "login" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ExternalLink aria-hidden="true" />}
                  {account.status === "connected" ? "계정 변경" : account.status === "disconnected" ? "로그인" : "다시 로그인"}
                </Button>
                {account.status !== "connected" && <Button variant="outline" disabled={state.busy !== null} onClick={() => void state.act(platform, "import_safari")}>
                  {state.busy === platform && state.busyAction === "import_safari" ? <><LoaderCircle aria-hidden="true" className="animate-spin" />가져오는 중…</> : "Safari에서 가져오기"}
                </Button>}
                {account.status !== "disconnected" && <Button variant="ghost" disabled={state.busy !== null} onClick={() => void state.act(platform, "disconnect")}>연결 해제</Button>}
              </>}
            </div>
          </article>;
        })}
      </div>
    </section>
  </div>;
}
