import { resolveTikTokPostUrl } from "@/domains/research/server/apify/post-url";
import { socialSource } from "@/domains/research/domain/source";
import type { ProductionRequest } from "../../../domain/start/input";
import type { ProductionStore } from "../../persistence/store";
import { externalReferences } from "../../references/library";
import { createRequest } from "../protocol";
import type { TelegramClient } from "../client";
import type { TelegramStore } from "../store";

export async function requestFromText(store: ProductionStore, text: string, resolve=resolveTikTokPostUrl) {
  const match=text.trim().match(/^(https?:\/\/\S+)(?:\s+([\s\S]*))?$/i);
  if(!match) return createRequest(text,()=>undefined);
  const parsedUrl=new URL(match[1]);
  const source=["youtube.com","www.youtube.com"].includes(parsedUrl.hostname)
    ? socialSource(match[1],"post") : await resolve(match[1]);
  const samePost=(url:unknown)=>{
    if(typeof url!=="string") return false;
    try {const candidate=socialSource(url,"post");return candidate.platform===source.platform && candidate.id===source.id;}
    catch {return false;}
  };
  return createRequest(`${source.url}${match[2] ? ` ${match[2]}` : ""}`, () => {
    const post = store.logs().find(row => samePost(row.post_url) && row.project_id);
    if (post) return { mode: "past_post", sourceProjectId: String(post.project_id), instructions: "" };
    const reference = externalReferences(store.db).find(row => samePost(row.url));
    return reference ? { mode: "spy_reference", referenceId: String(reference.id), instructions: "" } : undefined;
  });
}

export async function sendSources(client: TelegramClient, state: TelegramStore, user: string,
  store: ProductionStore, kind: "posts" | "refs", query: string) {
  const rows = kind === "posts"
    ? store.logs(query).filter(row => row.actual_published_at && row.project_id)
      .sort((a, b) => String(b.actual_published_at).localeCompare(String(a.actual_published_at)))
    : externalReferences(store.db, query);
  if (!rows.length) await client.send(user, "검색 결과가 없습니다.");
  for (const row of rows.slice(0, 5)) {
    const request: ProductionRequest = kind === "posts"
      ? { mode: "past_post", sourceProjectId: String(row.project_id), instructions: "" }
      : { mode: "spy_reference", referenceId: String(row.id), instructions: "" };
    const id = state.choice(request);
    const url = String(row.post_url ?? row.url ?? "");
    await client.send(user, [row.name ?? row.title ?? row.topic ?? "게시글", row.topic, row.content_type, url]
      .filter(Boolean).join("\n"), [[{ text: "이 자료로 제작", callback_data: `pick:${id}` }, ...(kind === "posts" ? [{text:"결과 받기",callback_data:`result:${id}`}] : [])]]);
  }
  if (rows.length > 5) await client.send(user, `총 ${rows.length}개 중 5개입니다. 검색어로 범위를 좁혀 주세요.`);
}
