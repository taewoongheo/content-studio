import { isAbsolute } from "node:path";
import { statSync } from "node:fs";
import { LOCAL_DATABASE_PATH } from "@/lib/local-db/database";
import { z } from "zod";
export const experimentStepSchema = z.enum(["analysis", "hook", "visual"]);

export function assertExperimentEnvironment() {
  const path = process.env.CONTENT_STUDIO_DB_PATH;
  if (process.env.CONTENT_STUDIO_EXPERIMENT !== "1" || process.env.CONTENT_STUDIO_DISABLE_COLLECTION !== "1" || !path || !isAbsolute(path))
    throw new Error("노드 실험은 수집·전송이 꺼진 별도 DB 환경에서만 실행할 수 있습니다.");
  const snapshot = statSync(path);
  const production = statSync(LOCAL_DATABASE_PATH, { throwIfNoEntry: false });
  // File identity also rejects symbolic and hard links to the operating database.
  if (production && snapshot.dev === production.dev && snapshot.ino === production.ino)
    throw new Error("운영 DB에서는 실험할 수 없습니다.");
}
