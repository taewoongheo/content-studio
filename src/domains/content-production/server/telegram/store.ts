import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { ProductionRequest } from "../../domain/start/input";

export class TelegramStore {
  constructor(private readonly db: Database.Database, private readonly bot: string) {}
  get<T>(key: string): T | undefined {
    const row=this.db.prepare("SELECT value FROM content_telegram_state WHERE bot=? AND key=?").get(this.bot,key) as {value:string}|undefined;
    return row ? JSON.parse(row.value) as T : undefined;
  }
  set(key: string, value: unknown) {
    this.db.prepare("INSERT INTO content_telegram_state(bot,key,value) VALUES(?,?,?) ON CONFLICT(bot,key) DO UPDATE SET value=excluded.value").run(this.bot,key,JSON.stringify(value));
  }
  claim(update: number) {
    if (update < (this.get<number>("offset") ?? 0)) return false;
    // Persist before executing. A crash never automatically replays a creation command.
    this.set("offset",update+1);
    return true;
  }
  choice(request: ProductionRequest) {
    const id=randomUUID();
    this.set(`choice:${id}`,{request,expires:Date.now()+86400000});
    return id;
  }
  readChoice(id: string) {
    const choice=this.get<{request:ProductionRequest;expires:number}>(`choice:${id}`);
    if (!choice || choice.expires<Date.now()) throw new Error("선택이 만료되었습니다. /posts 또는 /refs로 다시 조회해 주세요.");
    return choice.request;
  }
}
