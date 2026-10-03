import { ContentJobDomainError } from "../domain/domain";
import { ContentJobError } from "../workflow/registry";
import { ContentJobInputError } from "./upload";

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "";
}

export function contentJobErrorResponse(error: unknown) {
  if (
    error instanceof ContentJobInputError ||
    errorName(error) === "ContentJobInputError"
  )
    return Response.json(
      { error: (error as ContentJobInputError).message },
      { status: 400 },
    );
  if (
    error instanceof ContentJobDomainError ||
    errorName(error) === "ContentJobDomainError"
  ) {
    const domainError = error as ContentJobDomainError;
    return Response.json(
      { error: domainError.message, code: domainError.code },
      { status: domainError.code === "REVISION_CONFLICT" ? 409 : 422 },
    );
  }
  if (
    error instanceof ContentJobError ||
    errorName(error) === "ContentJobError"
  ) {
    const contentError = error as ContentJobError;
    const statuses: Record<ContentJobError["code"], number> = {
      JOB_NOT_FOUND: 404,
      OPERATION_IN_PROGRESS: 409,
      CODEX_UNAVAILABLE: 503,
      INVALID_OUTPUT: 422,
      INVALID_STAGE: 409,
    };
    return Response.json(
      { error: contentError.message, code: contentError.code },
      { status: statuses[contentError.code] },
    );
  }
  console.error("콘텐츠 작업 요청을 처리하지 못했습니다.", error);
  return Response.json(
    { error: "요청을 처리하지 못했습니다." },
    { status: 500 },
  );
}
