import { ZodError } from "zod";
import { OperationError } from "@/lib/errors/operation";
import type { ProductionFailure, ToolAttempt } from "../../../domain/diagnostics";

export function requiredToolFailure(calls: ToolAttempt[], tools: string[], message: string) {
  const attempts = calls.filter(call => tools.includes(call.tool));
  const code = !attempts.length ? "REQUIRED_TOOL_NOT_CALLED"
    : attempts.some(call => call.status === "failed") ? "REQUIRED_TOOL_FAILED"
    : attempts.some(call => call.status === "pending") ? "REQUIRED_TOOL_INCOMPLETE"
    : "REQUIRED_TOOL_EMPTY_RESULT";
  const reasons = {
    REQUIRED_TOOL_NOT_CALLED: "필수 도구를 호출하지 않았습니다.",
    REQUIRED_TOOL_FAILED: "필수 도구 호출이 실패했습니다. 아래 호출별 오류를 확인해 주세요.",
    REQUIRED_TOOL_INCOMPLETE: "필수 도구 호출이 완료되지 않았습니다.",
    REQUIRED_TOOL_EMPTY_RESULT: "도구 응답은 받았지만 필요한 결과가 없습니다.",
  };
  return new OperationError(code, `${message} ${reasons[code]}`, { required_tools: tools });
}
export function productionFailure(error: unknown, step: string, phase: string, calls: ToolAttempt[]): ProductionFailure {
  const operation = error instanceof OperationError;
  return {
    code: operation ? error.code : error instanceof ZodError
      ? phase === "output" ? "OUTPUT_SCHEMA_INVALID" : "DRAFT_VALIDATION_FAILED"
      : error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "STAGE_EXECUTION_FAILED",
    message: error instanceof ZodError ? "데이터 형식이 스키마와 맞지 않습니다. 필드별 오류를 확인해 주세요."
      : error instanceof Error ? error.message : "실행 실패",
    step, phase: operation && (error.code.startsWith("CLI_OUTPUT_") || ["OUTPUT_SCHEMA_INVALID", "OUTPUT_REPAIR_EXHAUSTED"].includes(error.code)) ? "output" : phase,
    details: operation ? error.details : error instanceof ZodError ? { issues: error.issues } : {},
    tool_calls: calls,
  };
}
