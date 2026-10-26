import { readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import { defaultDatabasePath } from "@/lib/local-db/database";

function translationCachePath() {
  const directory = process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR ??
    join(dirname(defaultDatabasePath()), ".content-studio-production");
  if (!isAbsolute(directory)) throw new Error("번역 캐시 경로는 절대 경로여야 합니다.");
  return join(directory, "display-translations.json");
}

export function loadTranslationCache(): Map<string, string> {
  try {
    const data = JSON.parse(readFileSync(translationCachePath(), "utf8"));
    if (data.version !== 1 || !Array.isArray(data.entries)) return new Map();
    return new Map(data.entries.filter((entry: unknown) => Array.isArray(entry) && entry.length === 2 &&
      typeof entry[0] === "string" && /^[a-f0-9]{64}$/.test(entry[0]) && typeof entry[1] === "string").slice(-1024));
  } catch { return new Map(); } // A missing or damaged display cache is expendable.
}
export function saveTranslationCache(cache: Map<string, string>) {
  const path = translationCachePath(), temporary = `${path}.${randomUUID()}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temporary, JSON.stringify({ version: 1, entries: [...cache] }), { mode: 0o600 });
    renameSync(temporary, path);
  } catch { /* Cache writes must not fail a successful translation. */ }
  finally { try { rmSync(temporary, { force: true }); } catch {} }
}
