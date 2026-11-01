import { collectYouTube } from "@/domains/research/collectors/platforms/youtube";
import { socialSource } from "@/domains/research/domain/source";
import { ensureReferenceImages } from "../references/spy/images";
import { ApifyTikTokClient } from "@/domains/research/server/apify/client";
import { collectVisuals, saveVisuals } from "../publication/visuals";
import { publishChange } from "../events";
import type { ProductionStore } from "../persistence/store";

/** A URL request is not analyzable until every source slide is preserved locally. */
export async function prepareStartInput(store: ProductionStore, id: string, signal: AbortSignal,
  client: Pick<ApifyTikTokClient, "posts"> = new ApifyTikTokClient(), capture = collectVisuals, youtube = collectYouTube) {
  const input = store.assertActive(id, "analysis").input!;
  if (input.source?.visual_set_id) return;
  if (input.request.mode === "spy_reference") {
    // Reuse the library image cache; selecting a post never collects the entire account.
    const source = store.requestSource(input.request)!;
    const setId = await ensureReferenceImages(store.db, input.request.referenceId, client, capture, signal);
    signal.throwIfAborted();
    store.assertActive(id, "analysis");
    store.requestSource(input.request);
    const set = store.db.prepare("SELECT slide_count FROM content_visual_sets WHERE id=?").get(setId) as { slide_count: number };
    store.savePreparedSource(id, { ...source, visual_set_id: setId, slide_count: set.slide_count });
    return;
  }
  if (input.request.mode !== "external_url") return;
  const url = input.request.url;
  publishChange({ task_id: id, step: "analysis", kind: "state", detail: "외부 게시글 수집 중" });
  const source=socialSource(url,"post");
  const post=source.platform==="youtube"
    ? await youtube({kind:"post",source,limit:1},{sessionId:id,signal}).then(result=>{
      const selected=result.posts.find(post=>post.id===source.id);
      if(!selected)throw new Error("요청한 YouTube 게시글을 찾을 수 없습니다.");
      return {id:selected.id,url:selected.url,text:selected.text,images:selected.media.filter(media=>media.type==="image").map(media=>media.url)};
    })
    : (await client.posts([url],signal))[0];
  if (!post?.images.length) throw new Error("외부 게시글의 슬라이드쇼 이미지를 가져오지 못했습니다.");
  const slides = await capture(post.images, signal);
  signal.throwIfAborted();
  if (slides.length !== post.images.length) throw new Error("외부 게시글의 전체 슬라이드 이미지를 확보하지 못했습니다.");
  store.assertActive(id, "analysis");
  store.db.transaction(() => {
    const setId = saveVisuals(store.db, { kind: "reference", url, slides });
    store.savePreparedSource(id, { id: post.id, url: post.url, caption: post.text,
      visual_set_id: setId, slide_count: slides.length });
  })();
}
