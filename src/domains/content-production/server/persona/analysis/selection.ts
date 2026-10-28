import type { ApifyAccountPostsClient } from "@/domains/research/server/apify/account-posts";

type Post = Awaited<ReturnType<ApifyAccountPostsClient["posts"]>>[number];
export interface SelectedPersonaPost { post: Post; group: "popular" | "latest" }
// Widen metadata only; download images after selecting the final distinct posts.
const candidateLimits = [5, 10, 20, 40, 80, 100] as const;
const postsPerGroup = 5;

export async function selectPersonaPosts(handle: string, signal: AbortSignal,
  client: Pick<ApifyAccountPostsClient, "postsWithCount">, progress: (message: string) => void) {
  const selected: SelectedPersonaPost[] = [];
  const used = new Set<string>();
  for (const group of ["popular", "latest"] as const) {
    const groupPosts: Post[] = [];
    for (const limit of candidateLimits) {
      signal.throwIfAborted();
      progress(`TikTok ${group === "popular" ? "인기" : "최신"} 슬라이드쇼 선별 중 · 후보 ${limit}개 조회`);
      const { posts, fetchedCount } = await client.postsWithCount(handle, signal, { limit, sorting: group, allLanguages: true });
      // Keep the provider's popular ranking; latest ordering uses actual publication dates.
      const candidates = group === "popular" ? posts : [...posts].sort((a, b) =>
        (b.published_at ?? "").localeCompare(a.published_at ?? "") || b.id.localeCompare(a.id));
      groupPosts.length = 0;
      const groupIds = new Set<string>();
      for (const post of candidates) {
        if (used.has(post.id) || groupIds.has(post.id)) continue;
        groupIds.add(post.id);
        groupPosts.push(post);
        if (groupPosts.length === postsPerGroup) break;
      }
      // Count raw results, not just carousels, so videos do not falsely signal exhaustion.
      if (groupPosts.length === postsPerGroup || fetchedCount < limit) break;
    }
    for (const post of groupPosts) {
      used.add(post.id);
      selected.push({ post, group });
    }
  }
  return selected;
}
