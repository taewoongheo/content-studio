import { unlink, rmdir } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { ReferenceImageInput } from "../../../domain/types";

// Only removes the uploaded analysis inputs, never the user's source files or chat attachments.
export async function releaseReferenceImages(images: ReferenceImageInput[]) {
  const temporaryImages = images.filter((image) => basename(dirname(image.path)).startsWith("content-studio-job-"));
  await Promise.all(temporaryImages.map(async (image) => {
    try { await unlink(image.path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        console.warn("분석용 임시 이미지 정리에 실패했습니다.", error);
    }
  }));
  const directories = new Set(temporaryImages.map((image) => dirname(image.path)));
  await Promise.all([...directories]
    .map(async (directory) => {
      try { await rmdir(directory); }
      catch (error) {
        if (!["ENOENT", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code ?? ""))
          console.warn("분석용 임시 폴더 정리에 실패했습니다.", error);
      }
    }));
}
