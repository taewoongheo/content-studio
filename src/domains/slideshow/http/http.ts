import { ZodError } from "zod/v4";
import { OperationError } from "@/lib/errors/operation";
import { TemplateError } from "@/domains/slideshow/projects/composition";
import { ContentJobError } from "@/domains/slideshow/workflow/registry";
export function contentJobErrorResponse(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: error.issues.map(issue => issue.message).join(" ") }, { status: 400 });
  if (error instanceof OperationError) {
    const status = error.code === "PROJECT_NOT_OPEN" ? 404 : ["REVISION_CONFLICT", "TAB_CONFLICT"].includes(error.code) ? 409 : 422;
    const code = error.code === "PROJECT_NOT_OPEN" ? "JOB_NOT_FOUND"
      : ["REVISION_CONFLICT", "TAB_CONFLICT"].includes(error.code) ? "INVALID_STAGE"
      : ["COMMAND_FAILED", "INVALID_INPUT"].includes(error.code) ? "INVALID_OUTPUT" : error.code;
    return Response.json({ error: error.message, code, errorCode: error.code, details: error.details, recovery: error.recovery }, { status });
  }
  if (error instanceof TemplateError)
    return Response.json({ error: error.message }, { status: error.code === "PROJECT_NOT_FOUND" ? 404 : 422 });
  if (error instanceof ContentJobError || (error instanceof Error && error.name === "ContentJobError")) {
    const failure = error as ContentJobError;
    const status = { JOB_NOT_FOUND: 404, INVALID_OUTPUT: 422, INVALID_STAGE: 409 }[failure.code];
    return Response.json({ error: failure.message, code: failure.code }, { status });
  }
  if (error instanceof SyntaxError)
    return Response.json({ error: "JSON 형식을 확인해 주세요." }, { status: 400 });
  console.error("편집 요청을 처리하지 못했습니다.", error);
  return Response.json({ error: "요청을 처리하지 못했습니다." }, { status: 500 });
}
