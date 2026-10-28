import { ApifyTikTokClient } from "@/domains/research/server/apify/client";
import { collectVisuals, saveVisuals } from "../publication/visuals";
import { publishChange } from "../events";
import type { ProductionStore } from "../persistence/store";

/** A URL request is not analyzable until every source slide is preserved locally. */
export async function prepareStartInput(store: ProductionStore, id: string, signal: AbortSignal,
  client: Pick<ApifyTikTokClient, "posts"> = new ApifyTikTokClient(), capture = collectVisuals) {
  const input = store.assertActive(id, "analysis").input!;
  if (input.request.mode !== "external_url" || input.source?.visual_set_id) return;
  publishChange({ task_id: id, step: "analysis", kind: "state", detail: "외부 게시글 수집 중" });
  const [post] = await client.posts([input.request.url], signal);
  if (!post?.images.length) throw new Error("외부 게시글의 슬라이드쇼 이미지를 가져오지 못했습니다.");
  const slides = await capture(post.images, signal);
  signal.throwIfAborted();
  if (slides.length !== post.images.length) throw new Error("외부 게시글의 전체 슬라이드 이미지를 확보하지 못했습니다.");
  store.assertActive(id, "analysis");
  store.db.transaction(() => {
    const setId = saveVisuals(store.db, { kind: "reference", url: input.request.mode === "external_url" ? input.request.url : "", slides });
    store.savePreparedSource(id, { id: post.id, url: post.url, caption: post.text,
      visual_set_id: setId, slide_count: slides.length });
  })();
}
