import Database from "better-sqlite3";
import { defaultDatabasePath } from "../src/lib/local-db/database";
import { migrateTemplateLoop } from "../src/lib/local-db/projects/migrate-loop";

const path = defaultDatabasePath();
const database = new Database(path, { fileMustExist: true });
try {
  if ((database.pragma("user_version", { simple: true }) as number) > 10) throw new Error("지원하지 않는 DB 버전입니다.");
  if (database.pragma("user_version", { simple: true }) === 10) {
    console.log("이미 최신 템플릿 스키마입니다.");
  } else {
    const backupPath = `${path}.before-template-loop-${Date.now()}.bak`;
    await database.backup(backupPath);
    database.pragma("foreign_keys = ON");
    migrateTemplateLoop(database);
    console.log(JSON.stringify({ path, backupPath, version: database.pragma("user_version", { simple: true }) }));
  }
} finally { database.close(); }
