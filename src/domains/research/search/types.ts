import * as z from "zod/v4";
import type { Platform } from "@/domains/research/domain/schema";
export const searchTypeSchema = z.enum(["accounts", "posts"]);
export const searchInputSchema = z.strictObject({ platform: z.literal("youtube"), query: z.string().trim().min(1).max(150),
  type: searchTypeSchema.default("posts"), limit: z.number().int().min(1).max(30).default(10) });
export type SearchInput = z.infer<typeof searchInputSchema>;
export type SocialAccount = { id: string; platform: Platform; url: string; username: string; name: string; followerCount: number | null };
export function searchUrl(input: SearchInput) {
  const query = encodeURIComponent(input.query);
  return `https://www.youtube.com/results?search_query=${query}`;
}
