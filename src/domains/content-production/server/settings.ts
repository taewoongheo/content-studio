import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { defaultDatabasePath } from "@/lib/local-db/database";
export const productionSettingsSchema = z
  .object({
    model: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9._:-]+$/, "모델 이름을 확인해 주세요."),
  })
  .strict();
export type ProductionSettings = z.infer<typeof productionSettingsSchema>;
export function productionRuntimePath(file: string) {
  const directory =
    process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR ??
    join(dirname(defaultDatabasePath()), ".content-studio-production");
  if (!isAbsolute(directory))
    throw new Error("콘텐츠 제작 설정 경로는 절대 경로여야 합니다.");
  return join(directory, file);
}
export function readProductionSettings(): ProductionSettings {
  try {
    return productionSettingsSchema.parse(
      JSON.parse(readFileSync(productionRuntimePath("settings.json"), "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { model: "gpt-5.6-sol" };
    throw error;
  }
}
export function saveProductionSettings(raw: unknown) {
  const settings = productionSettingsSchema.parse(raw),
    path = productionRuntimePath("settings.json"),
    temporary = `${path}.${randomUUID()}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(temporary, JSON.stringify(settings), { mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
  return settings;
}
