import { OperationError } from "@/lib/errors/operation";
import { ZodError } from "zod";
export function videoError(error: unknown) {
  if (error instanceof OperationError) return Response.json({ error: error.message, code: error.code, details: error.details, recovery: error.recovery }, { status: 400 });
  return Response.json({ error: error instanceof ZodError ? `영상 설정을 확인해 주세요: ${error.issues[0]?.message}` : error instanceof Error ? error.message : "영상 요청을 처리하지 못했습니다." }, { status: 400 });
}
