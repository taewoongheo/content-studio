import { productionRequestSchema, type ProductionRequest } from "../../domain/start/input";

export type TelegramUpdate = {
  update_id: number;
  message?: { message_id?:number; reply_to_message?: {message_id:number;text?:string;caption?:string}; text?: string; from?: { id: number }; chat: { id: number; type: string } };
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
/create [URL] [추가요청] — 링크로 제작 (등록된 내 글·외부 자료는 해당 방식)
/posts [검색어] — 과거 게시글
/refs [검색어] — 외부 레퍼런스
/status — 서버 연결 확인
/job — 전체 작업 번호·상태 및 결과 받기
/get [작업번호] — 전체 이미지 받기
/edit [작업번호] [요청] — 완성 draft 슬라이드 수정
/copy [작업번호] — 제목·캡션·해시태그 생성
/publish [작업번호] [게시글 링크] — 게시 등록 및 draft 완료
받은 이미지나 문구에 답장해서 요청할 수도 있습니다.
/stop [작업번호] — 선택 취소 또는 작업 중단
/resume [작업번호] — 중단·실패 작업 재개
/reset — 전체 제작 작업 초기화
목록에서 제작 버튼을 누른 뒤 추가요청을 입력할 수도 있습니다.`;
