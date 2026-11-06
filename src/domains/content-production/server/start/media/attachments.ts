import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isExternalProduction, type ProductionInput } from "../../../domain/start/input";
import type { ProductionStep } from "../../../domain/contracts";
import type { ProductionStore } from "../../persistence/store";
import { OperationError } from "@/lib/errors/operation";

/** Attach the complete stored source once per draft/review execution, then remove temporary files. */
export async function withReferenceImages<T>(
  store: ProductionStore, input: ProductionInput, step: ProductionStep,
  signal: AbortSignal, execute: (paths: string[]) => Promise<T>,
): Promise<T> {
  signal.throwIfAborted();
  if (!isExternalProduction(input) || !["production", "visual"].includes(step)) return execute([]);
  const setId = input.source?.visual_set_id;
  const set = store.db.prepare("SELECT slide_count FROM content_visual_sets WHERE id=?").get(setId ?? "") as { slide_count: number } | undefined;
  const slides = store.db.prepare("SELECT slide_index,data FROM content_visual_slides WHERE set_id=? ORDER BY slide_index").all(setId ?? "") as Array<{ slide_index: number; data: Buffer }>;
  if (!set || !slides.length || slides.length !== set.slide_count ||
      (input.source?.slide_count !== undefined && slides.length !== input.source.slide_count) ||
      slides.some((slide, index) => slide.slide_index !== index || !slide.data.length))
    throw new OperationError("REFERENCE_IMAGES_INCOMPLETE", "외부 원본의 전체 이미지가 필요합니다. 보존된 자료를 확인해 주세요.");
  const directory = await mkdtemp(join(tmpdir(), "content-reference-"));
  try {
    const paths: string[] = [];
    for (const slide of slides) {
      signal.throwIfAborted();
      const path = join(directory, `slide-${slide.slide_index + 1}.webp`);
      await writeFile(path, slide.data);
      paths.push(path);
    }
    signal.throwIfAborted();
    return await execute(paths);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
