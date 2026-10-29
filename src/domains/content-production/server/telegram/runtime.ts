import { setTimeout as delay } from "node:timers/promises";
import { getLocalDatabase } from "@/lib/local-db/database";
import { TelegramClient } from "./client";
import { TelegramStore } from "./store";
import { TelegramHandler } from "./handler";
import type { TelegramUpdate } from "./protocol";

const shared=globalThis as typeof globalThis & {telegramStarted?:boolean};
export function startTelegram() {
  if(shared.telegramStarted) return;
  const token=process.env.TELEGRAM_BOT_TOKEN?.trim(),user=process.env.TELEGRAM_ALLOWED_USER_ID?.trim();
  if(!token || !/^\d+:[\w-]+$/.test(token) || !user || !/^\d+$/.test(user)) {
    console.error("텔레그램 비활성: TELEGRAM_BOT_TOKEN과 TELEGRAM_ALLOWED_USER_ID를 설정해 주세요.");return;
  }
  const origin=process.env.CONTENT_STUDIO_TELEGRAM_ORIGIN ?? "http://127.0.0.1:3000";
  const url=new URL(origin);
  if(url.protocol!=="http:" || url.hostname!=="127.0.0.1" || url.username || url.password || url.pathname!=="/" || url.search || url.hash) {
    console.error("CONTENT_STUDIO_TELEGRAM_ORIGIN은 http://127.0.0.1:포트 형식이어야 합니다.");return;
  }
  shared.telegramStarted=true;
  const client=new TelegramClient(token);
  const state=new TelegramStore(getLocalDatabase(),`${token.split(":")[0]}:${user}`);
  const handler=new TelegramHandler(client,state,user,url.origin);
  // Do not block Next.js startup; reconnect after transient network failures.
  void (async()=> {
    let configured=false;
    while(true) {
      try {
        if(!configured) {
          const webhook=await client.call<{url:string}>("getWebhookInfo",{});
          if(webhook.url) throw new Error("봇에 webhook이 등록되어 있습니다. 전용 봇을 사용하거나 webhook을 해제해 주세요.");
          await client.call("setMyCommands",{commands:[
            {command:"create",description:"콘텐츠 제작 (URL·추가요청 입력 가능)"},
            {command:"posts",description:"과거 게시글 조회"},
            {command:"refs",description:"외부 레퍼런스 조회"},
            {command:"status",description:"서버 연결 확인"},
            {command:"job",description:"전체 작업 번호·상태 조회"},
            {command:"stop",description:"선택 취소 또는 작업 중단"},
            {command:"resume",description:"작업번호로 중단·실패 작업 재개"},
            {command:"reset",description:"전체 제작 작업 초기화"},
            {command:"help",description:"사용법"},
          ]});
          configured=true;
        }
        const updates=await client.call<TelegramUpdate[]>("getUpdates",{
          offset:state.get<number>("offset") ?? 0,timeout:20,allowed_updates:["message","callback_query"],
        });
        for(const update of updates) {
          await handler.handle(update);
          // Also acknowledge ignored users so an unauthorized message cannot stall polling.
          state.claim(update.update_id);
        }
        await handler.notify();
      } catch(error) {
        console.error(error instanceof Error ? error.message : "텔레그램 처리 실패");
        await delay(5000);
      }
    }
  })();
}
