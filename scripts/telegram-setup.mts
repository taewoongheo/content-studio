import { TelegramClient } from "../src/domains/content-production/server/telegram/client";
// Run with: node --env-file=.env.local --import tsx scripts/telegram-setup.mts
const token=process.env.TELEGRAM_BOT_TOKEN?.trim();
if(!token) throw new Error("먼저 .env.local에 TELEGRAM_BOT_TOKEN을 넣어 주세요.");
const client=new TelegramClient(token);
const call=(method:string)=>client.call<Record<string,unknown> | Array<unknown>>(method,{timeout:0,allowed_updates:["message"]});

try {
  const me=await call("getMe") as {username:string};
  console.log(`봇: @${me.username}`);
  const updates=await call("getUpdates") as Array<{message?:{chat:{type:string};text?:string;from:{id:number}}}>;
  const ids=new Set(updates.filter((u:{message?:{chat:{type:string};text?:string}})=>u.message?.chat.type==="private" && u.message.text==="/start")
    .map(u=>u.message!.from.id));
  console.log(ids.size ? `최근 /start 발신자 ID: ${[...ids].join(", ")}\n본인 ID를 TELEGRAM_ALLOWED_USER_ID에 설정하세요.` : "봇과의 개인 채팅에서 /start를 보낸 뒤 다시 실행하세요.");
} catch { console.error("연결 확인 실패. 토큰·인터넷 연결을 확인하고 앱의 봇 수신기를 끈 상태에서 다시 실행하세요.");process.exitCode=1; }
