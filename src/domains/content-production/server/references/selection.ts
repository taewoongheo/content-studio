import type Database from "better-sqlite3";
import { REFERENCE_LIMIT, type ExternalContext } from "../../domain/references/context";
import type { ProductionStep } from "../../domain/contracts";
import { externalReferences } from "./library";
import { getReferenceContext, saveReferenceContext } from "./context";

const locks = new Map<string, Promise<ExternalContext>>();
function assertActive(db: Database.Database, id: string, step: ProductionStep) {
  if (!db.prepare("SELECT 1 FROM content_drafts WHERE id=? AND current_step=? AND state='running'").get(id,step))
    throw new Error("현재 실행 중인 단계에서만 레퍼런스를 조회할 수 있습니다.");
}
export function referenceImagesAllowed(db: Database.Database, id: string, step: ProductionStep, setId: string) {
  const external = db.prepare("SELECT id FROM content_external_references WHERE visual_set_id=?").get(setId);
  if (!external) return true; // Existing published/legacy images keep their own read path.
  return !!getReferenceContext(db,id,step)?.posts.some(post => post.visual_set_id === setId);
}
export function queryStageReferences(db: Database.Database, id: string, step: ProductionStep, input: {
  query: string; content_type: string; collect: boolean; ids?: string[];
}): Promise<ExternalContext> {
  const key = `${db.name}:${id}:${step}`;
  const previous = locks.get(key);
  const work = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(run);
  locks.set(key,work);
  void work.finally(() => { if (locks.get(key) === work) locks.delete(key); }).catch(() => undefined);
  return work;
  async function run() {
    assertActive(db,id,step);
    if (input.collect) throw new Error("노드에서는 새 외부 레퍼런스를 수집하지 않습니다. 스파이 대시보드에서 갱신해 주세요.");
    let context = getReferenceContext(db,id,step) ?? empty("");
    if (!context.queries.includes(input.query)) context.queries.push(input.query);
    const select = () => {
      const used = new Set(context.posts.map(post => post.id));
      const candidates = externalReferences(db,input.query,input.content_type)
        .filter(post => !used.has(post.id) && (!input.ids?.length || input.ids.includes(String(post.id))));
      return candidates.slice(0,Math.max(0,REFERENCE_LIMIT-context.posts.length));
    };
    const selected = select();
    context = db.transaction(() => {
      assertActive(db,id,step);
      const now = new Date().toISOString();
      for (const post of selected) {
        const { images_json: images, ...snapshot } = post;
        void images;
        context.posts.push(snapshot);
      }
      context.checked_at = now;
      if (!context.posts.length && !context.message) context.message = "No suitable stored examples matched. Refresh spy accounts from the dashboard before starting another batch.";
      saveReferenceContext(db,id,step,context);
      return context;
    })();
    return { ...context, posts: context.posts.filter(post => !!db.prepare("SELECT 1 FROM content_external_references WHERE id=? AND excluded=0").get(post.id)) };
  }
}
function empty(message: string): ExternalContext {
  return {checked_at:new Date().toISOString(),queries:[],collection_attempted:false,message,posts:[]};
}
