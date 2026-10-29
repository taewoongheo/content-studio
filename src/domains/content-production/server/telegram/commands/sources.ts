import type { ProductionRequest } from "../../../domain/start/input";
import type { ProductionStore } from "../../persistence/store";
import { externalReferences } from "../../references/library";
import { createRequest } from "../protocol";
import type { TelegramClient } from "../client";
import type { TelegramStore } from "../store";

export function requestFromText(store: ProductionStore, text: string) {
  return createRequest(text, url => {
    const post = store.logs().find(row => row.post_url === url && row.project_id);
    if (post) return { mode: "past_post", sourceProjectId: String(post.project_id), instructions: "" };
    const reference = externalReferences(store.db).find(row => row.url === url);
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
      .filter(Boolean).join("\n"), [[{ text: "이 자료로 제작", callback_data: `pick:${id}` }]]);
  }
  if (rows.length > 5) await client.send(user, `총 ${rows.length}개 중 5개입니다. 검색어로 범위를 좁혀 주세요.`);
}
