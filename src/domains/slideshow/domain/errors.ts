export class SlideshowMetadataError extends Error {
  constructor(public readonly code: "PROJECT_NOT_FOUND" | "COMPOSITION_REQUIRED" | "INVALID_METADATA", message?: string) {
    super(message ?? (code === "PROJECT_NOT_FOUND" ? "문서를 찾을 수 없습니다." : "템플릿의 구성을 입력해 주세요."));
    this.name = "SlideshowMetadataError";
  }
}
