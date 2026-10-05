import type { SocialAccount, SearchInput } from "../search/types";
import type { AuthState } from "../accounts/storage/cookies";
import type { Page } from "playwright";
import type { ResearchCriteria, SocialPost } from "../domain/schema";
import type { socialSource } from "../domain/source";

export type Source = ReturnType<typeof socialSource>;
export type CollectionRequest = { source: Source; limit: number; criteria?: ResearchCriteria } & (
  { kind: "search"; search: SearchInput; cursor?: never; channelUrl?: never } |
  { kind: "post" | "account"; search?: never; cursor?: string; channelUrl?: string }
);
export type BlockReason = "captcha_required" | "login_required" | "rate_limited" | "access_denied" |
  "not_found" | "source_error" | "empty_response" | "unsupported" | "setup_required" | "timeout";
export class CollectionBlocked extends Error {
  constructor(public reason: BlockReason, message: string) { super(message); }
}
export type CollectionResult = { posts: SocialPost[]; accounts?: SocialAccount[]; nextCursor: string | null; warnings: string[] };
export type CollectorContext = { sessionId: string; signal: AbortSignal; getPage(): Promise<Page>; authState?: AuthState; persistAuthState?(state: AuthState): void };
export type Collector = (request: CollectionRequest, context: CollectorContext) => Promise<CollectionResult>;
