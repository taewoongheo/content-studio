import type Database from "better-sqlite3";
import { ApifyTikTokClient } from "@/domains/research/server/apify/client";
import { collectVisuals, saveVisuals } from "../../publication/visuals";
const pending = new Map<string,Promise<string>>();
export function ensureReferenceImages(db: Database.Database,id:string,client = new ApifyTikTokClient(),capture=collectVisuals) {
  const key=`${db.name}:${id}`;
  if (pending.has(key)) return pending.get(key)!;
  const work=run();pending.set(key,work);
  void work.finally(()=>pending.delete(key)).catch(()=>undefined);
  return work;
  async function run() {
    const read=()=>db.prepare("SELECT url,images_json,visual_set_id FROM content_external_references WHERE id=? AND excluded=0").get(id) as {url:string;images_json:string;visual_set_id:string|null}|undefined;
    const row=read();
    if (!row) throw new Error("사용 가능한 외부 레퍼런스가 아닙니다.");
    if (row.visual_set_id) return row.visual_set_id;
    try {
      let images=JSON.parse(row.images_json) as string[];
      let slides;
      try { slides=await capture(images); }
      catch {
        const [post]=await client.posts([row.url]);
        images=post.images;
        slides=await capture(images);
      }
      if (slides.length!==images.length) throw new Error("전체 슬라이드를 확보하지 못했습니다.");
      if (!read()) throw new Error("제외되거나 제거된 레퍼런스입니다.");
      return db.transaction(()=>{
        const set=saveVisuals(db,{kind:"reference",url:row.url,slides});
        db.prepare("UPDATE content_external_references SET visual_set_id=?,images_json=?,image_error=NULL WHERE id=?").run(set,JSON.stringify(images),id);
        return set;
      })();
    } catch(error) {
      db.prepare("UPDATE content_external_references SET image_error=? WHERE id=?").run(error instanceof Error?error.message:"이미지 확보 실패",id);
      throw error;
    }
  }
}
