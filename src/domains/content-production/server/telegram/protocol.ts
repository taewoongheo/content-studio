import { productionRequestSchema, type ProductionRequest } from "../../domain/start/input";

export type TelegramUpdate = {
  update_id: number;
  message?: { text?: string; from?: { id: number }; chat: { id: number; type: string } };
  callback_query?: { id: string; from: { id: number }; data?: string; message?: { chat: { id: number; type: string } } };
};
export function authorized(update: TelegramUpdate, userId: string) {
  const sender = update.callback_query?.from ?? update.message?.from;
  const chat = update.callback_query?.message?.chat ?? update.message?.chat;
  return sender && chat?.type === "private" && String(sender.id) === userId && String(chat.id) === userId;
}
export function command(text: string) {
  const match = text.trim().match(/^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/);
  return match ? { name: match[1].toLowerCase(), args: (match[2] ?? "").trim() } : null;
}
export function createRequest(args: string, resolve: (url: string) => ProductionRequest | undefined): ProductionRequest {
  const match = args.trim().match(/^(https?:\/\/\S+)(?:\s+([\s\S]*))?$/i);
  if (!match) return productionRequestSchema.parse({mode:"automatic",instructions:args});
  const urlRequest = productionRequestSchema.parse({mode:"external_url",url:match[1],instructions:match[2] ?? ""});
  return productionRequestSchema.parse({...resolve(urlRequest.mode === "external_url" ? urlRequest.url : match[1]) ?? urlRequest,instructions:match[2] ?? ""});
}
export const HELP = `/create [추가요청] — 자동 제작
/create URL [추가요청] — 링크로 제작 (등록된 내 글·외부 자료는 해당 방식)
/posts [검색어] — 과거 게시글
/refs [검색어] — 외부 레퍼런스
/status — 서버 연결 확인
/job — 전체 작업 번호·상태
/stop [작업번호] — 선택 취소 또는 작업 중단
/resume 작업번호 — 중단·실패 작업 재개
/reset — 전체 제작 작업 초기화
목록에서 제작 버튼을 누른 뒤 추가요청을 입력할 수도 있습니다.`;
