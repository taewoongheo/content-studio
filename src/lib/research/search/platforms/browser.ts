import type { Page, Response as BrowserResponse } from "playwright";
import { browserBlock } from "../../browser/blocks";
import { CollectionBlocked } from "../../collection/types";
import type { SocialPost } from "../../domain/schema";
import type { SocialAccount, SearchInput } from "../types";

type Parsed = { accounts: SocialAccount[]; posts: SocialPost[]; recognized: boolean };
type SearchOptions = { input: SearchInput; page: Page; signal: AbortSignal; url: string;
  matches(response: BrowserResponse): boolean; parse(payload: unknown): Parsed };
const RESPONSE_LIMIT = 2_000_000;
const SEARCH_TIMEOUT_MS = 20_000;
export async function browserSearch({ input, page, signal, url, matches, parse }: SearchOptions) {
  let responseCount = 0, settled = false, failure: CollectionBlocked | undefined;
  const posts = new Map<string, SocialPost>(), accounts = new Map<string, SocialAccount>();
  let recognized = false;
  let done!: () => void;
  const ready = new Promise<void>(resolve => { done = resolve; });
  const tasks = new Set<Promise<void>>();
  const handler = (response: BrowserResponse) => {
    if (settled || !matches(response) || ++responseCount > 12) return;
    const task = (async () => {
      if (response.status() === 429) { failure = new CollectionBlocked("rate_limited", "The platform search is rate limited."); done(); return; }
      if (!response.ok() && response.status() !== 401 && response.status() !== 403) return;
      const length = Number(response.headers()["content-length"]);
      if (length > RESPONSE_LIMIT) return;
      const body = await response.text(); if (settled || body.length > RESPONSE_LIMIT) return;
      const data = JSON.parse(body) as Record<string, unknown>;
      if (data.message === "login_required" || data.require_login === true) {
        failure = new CollectionBlocked("login_required", "The platform requires a new login. Reconnect in Dashboard → Settings."); done(); return;
      }
      if (response.status() === 401 || response.status() === 403) {
        failure = new CollectionBlocked("access_denied", "The platform denied this search; session expiration was not confirmed."); done(); return;
      }
      const parsed = parse(data);
      parsed.posts.forEach(post => { if (posts.size < input.limit) posts.set(post.id, post); });
      parsed.accounts.forEach(account => { if (accounts.size < input.limit) accounts.set(account.id, account); });
      if (parsed.recognized) {
        recognized = true;
        if (input.type === "posts" ? parsed.posts.length > 0 : parsed.accounts.length > 0) done();
      }
    })().catch(() => undefined);
    tasks.add(task); void task.finally(() => tasks.delete(task));
  };
  const cancel = () => { failure = new CollectionBlocked("source_error", "Search was cancelled."); done(); };
  const timer = setTimeout(done, SEARCH_TIMEOUT_MS); timer.unref();
  signal.addEventListener("abort", cancel, { once: true });
  page.on("response", handler);
  try {
    if (signal.aborted) cancel();
    else {
      const response = await page.goto(url, { waitUntil: "domcontentloaded" });
      const block = await browserBlock(page, response?.status());
      if (block) {
        if (block.reason === "access_denied" && response && matches(response)) {
          const raw = await response.text().catch(() => "");
          if (raw.length < RESPONSE_LIMIT) {
            try {
              const data = JSON.parse(raw);
              if (data.message === "login_required" || data.require_login === true)
                throw new CollectionBlocked("login_required", "The platform requires a new login. Reconnect in Dashboard → Settings.");
            } catch (error) { if (error instanceof CollectionBlocked) throw error; }
          }
        }
        throw block;
      }
      await ready;
    }
    if (failure) throw failure;
    const block = await browserBlock(page); if (block) throw block;
    if (!recognized) throw new CollectionBlocked("unsupported", "The platform did not expose a supported native search response. No external search was substituted.");
    return { posts: input.type === "posts" ? [...posts.values()] : [], accounts: input.type === "accounts" ? [...accounts.values()] : [],
      nextCursor: null, warnings: ["One bounded native search page. Results depend on the signed-in account and region; no pagination or comment text is collected."] };
  } finally {
    settled = true; clearTimeout(timer); signal.removeEventListener("abort", cancel); page.off("response", handler);
    // Context closure cancels unread network bodies; do not wait indefinitely.
    void Promise.allSettled([...tasks]);
  }
}
