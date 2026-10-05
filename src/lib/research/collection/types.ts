import type { Page } from "playwright";
import type { ResearchCriteria, SocialPost } from "../domain/schema";
import type { socialSource } from "../domain/source";

export type Source = ReturnType<typeof socialSource>;
export type CollectionRequest = { source: Source; kind: "post" | "account"; limit: number;
  criteria?: ResearchCriteria; cursor?: string; channelUrl?: string };
export type BlockReason = "captcha_required" | "login_required" | "rate_limited" | "access_denied" |
  "not_found" | "source_error" | "empty_response" | "unsupported" | "setup_required" | "timeout";
export class CollectionBlocked extends Error {
  constructor(public reason: BlockReason, message: string) { super(message); }
}
export type CollectionResult = { posts: SocialPost[]; nextCursor: string | null; warnings: string[] };
export type CollectorContext = { sessionId: string; signal: AbortSignal; getPage(): Promise<Page> };
export type Collector = (request: CollectionRequest, context: CollectorContext) => Promise<CollectionResult>;
