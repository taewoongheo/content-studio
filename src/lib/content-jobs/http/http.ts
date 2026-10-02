import { ContentJobError } from "../workflow/registry";
export function contentJobErrorResponse(error: unknown) {
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
