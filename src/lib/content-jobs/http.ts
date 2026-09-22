import { ContentJobDomainError } from "./domain";
import { ContentJobError } from "./registry";
import { ContentJobInputError } from "./upload";

export function contentJobErrorResponse(error: unknown) {
  if (error instanceof ContentJobInputError)
    return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof ContentJobDomainError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.code === "REVISION_CONFLICT" ? 409 : 422 },
    );
  if (error instanceof ContentJobError) {
    const statuses: Record<ContentJobError["code"], number> = {
      JOB_NOT_FOUND: 404,
      OPERATION_IN_PROGRESS: 409,
      CODEX_UNAVAILABLE: 503,
      INVALID_OUTPUT: 422,
      INVALID_STAGE: 409,
    };
    return Response.json(
      { error: error.message, code: error.code },
      { status: statuses[error.code] },
    );
  }
  return Response.json(
    { error: "요청을 처리하지 못했습니다." },
    { status: 500 },
  );
}
