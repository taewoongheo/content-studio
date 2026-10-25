import { readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, isAbsolute } from "node:path";
import sharp from "sharp";
import { OperationError } from "@/lib/errors/operation";

export function generatedImagesRoot() {
  return join(process.env.CODEX_HOME || join(homedir(), ".codex"), "generated_images");
}
/** Accept native generator outputs from this execution, never an external asset library. */
export async function readFreshGeneratedImage(path: string, startedAt: number, root = generatedImagesRoot()) {
  let base: string, file: string;
  try { [base,file] = await Promise.all([realpath(root),realpath(path)]); }
  catch { throw new OperationError("GENERATED_IMAGE_NOT_FOUND", "현재 CLI 실행의 생성 이미지 파일을 찾을 수 없습니다. 도구가 반환한 실제 경로를 사용해 주세요."); }
  const child = relative(base,file);
  if (!child || child === ".." || child.startsWith("../") || isAbsolute(child))
    throw new OperationError("GENERATED_IMAGE_PATH_INVALID", "내장 생성 도구의 실제 출력 파일만 가져올 수 있습니다.");
  const info = await stat(file);
  if (!info.isFile() || info.size > 40 * 1024 * 1024)
    throw new OperationError("GENERATED_IMAGE_INVALID", "생성 이미지 파일이 올바르지 않거나 40MB를 초과했습니다.");
  if (info.birthtimeMs < startedAt)
    throw new OperationError("GENERATED_IMAGE_NOT_FRESH", "이번 실행에서 새로 생성한 이미지만 사용할 수 있습니다.");
  const input = await readFile(file);
  let bytes: Buffer;
  try {
    const image = sharp(input, {limitInputPixels:40_000_000});
    const metadata = await image.metadata();
    if (!["png","jpeg","webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image");
    bytes = await image.rotate().webp({lossless:true}).toBuffer();
  } catch {
    throw new OperationError("GENERATED_IMAGE_INVALID", "생성 결과를 단일 WebP 이미지로 변환할 수 없습니다.");
  }
  if (bytes.length > 10 * 1024 * 1024)
    throw new OperationError("GENERATED_IMAGE_TOO_LARGE", "변환한 WebP가 프로젝트 이미지 한도 10MB를 초과했습니다.");
  return bytes;
}
