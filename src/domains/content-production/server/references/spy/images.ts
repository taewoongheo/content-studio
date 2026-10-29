import type Database from "better-sqlite3";
import { ApifyTikTokClient } from "@/domains/research/server/apify/client";
import { collectVisuals, saveVisuals } from "../../publication/visuals";
type PendingCapture = { work: Promise<string>; controller: AbortController; consumers: number; settled: boolean };
const pending = new Map<string, PendingCapture>();
export function ensureReferenceImages(db: Database.Database, id: string,
  client: Pick<ApifyTikTokClient, "posts"> = new ApifyTikTokClient(), capture = collectVisuals, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  const key = `${db.name}:${id}`;
  let entry = pending.get(key);
  if (!entry) {
    const controller = new AbortController();
    entry = { controller, consumers: 0, settled: false, work: run(controller.signal) };
    pending.set(key, entry);
    const created = entry;
    void created.work.finally(() => {
      created.settled = true;
      if (pending.get(key) === created) pending.delete(key);
    }).catch(() => undefined);
  }
  const current = entry;
  current.consumers++;
  const release = () => {
    current.consumers--;
    if (!current.consumers && !current.settled) {
      if (pending.get(key) === current) pending.delete(key);
      current.controller.abort();
    }
  };
  if (!signal) {
    void current.work.finally(release).catch(() => undefined);
    return current.work;
  }
  return new Promise<string>((resolve, reject) => {
    let finished = false;
    const finish = (callback: () => void) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener("abort", abort);
      release();
      callback();
    };
    const abort = () => finish(() => reject(signal.reason));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    current.work.then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
  });
  async function run(workSignal: AbortSignal) {
    const read=()=>db.prepare("SELECT url,images_json,visual_set_id FROM content_external_references WHERE id=? AND excluded=0").get(id) as {url:string;images_json:string;visual_set_id:string|null}|undefined;
    const row=read();
    if (!row) throw new Error("사용 가능한 외부 레퍼런스가 아닙니다.");
    if (row.visual_set_id) return row.visual_set_id;
    try {
      let images=JSON.parse(row.images_json) as string[];
      let slides;
      try { slides=await capture(images, workSignal); }
      catch {
        workSignal.throwIfAborted();
        const [post]=await client.posts([row.url], workSignal);
        images=post.images;
        slides=await capture(images, workSignal);
      }
      workSignal.throwIfAborted();
      if (slides.length!==images.length) throw new Error("전체 슬라이드를 확보하지 못했습니다.");
      if (!read()) throw new Error("제외되거나 제거된 레퍼런스입니다.");
      return db.transaction(()=>{
        const set=saveVisuals(db,{kind:"reference",url:row.url,slides});
        db.prepare("UPDATE content_external_references SET visual_set_id=?,images_json=?,image_error=NULL WHERE id=?").run(set,JSON.stringify(images),id);
        return set;
      })();
    } catch(error) {
      if (workSignal.aborted) throw error;
      db.prepare("UPDATE content_external_references SET image_error=? WHERE id=?").run(error instanceof Error?error.message:"이미지 확보 실패",id);
      throw error;
    }
  }
}
