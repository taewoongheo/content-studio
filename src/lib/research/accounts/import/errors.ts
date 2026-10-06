export const safariImportMessages = {
  unsupported: "Safari에서 가져오기는 macOS에서만 사용할 수 있습니다.",
  setup_required: "Safari 쿠키 가져오기 도구가 없습니다. pnpm setup:research를 실행해 주세요.",
  permission_required: "Safari 쿠키 파일을 읽을 권한이 없습니다. macOS 개인정보 보호 설정에서 서버를 실행한 앱의 파일 접근 권한을 확인해 주세요.",
  cookies_missing: "Safari의 기본 프로필에 저장된 로그인 쿠키가 없습니다. 해당 플랫폼에 로그인한 뒤 Safari를 완전히 종료하고 다시 가져와 주세요.",
  source_error: "Safari 쿠키를 가져오지 못했습니다. Safari를 종료한 뒤 다시 시도해 주세요.",
  busy: "진행 중인 로그인·검색·수집을 끝낸 뒤 Safari에서 가져와 주세요.",
} as const;
export type SafariImportReason = keyof typeof safariImportMessages;
export class SafariImportError extends Error {
  constructor(readonly reason: SafariImportReason) { super(safariImportMessages[reason]); }
}
