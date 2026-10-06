import * as z from "zod/v4";
import { platformSchema, type Platform } from "../domain/schema";
export const searchTypeSchema = z.enum(["accounts", "posts"]);
export const searchInputSchema = z.strictObject({ platform: platformSchema, query: z.string().trim().min(1).max(150),
  type: searchTypeSchema.default("posts"), limit: z.number().int().min(1).max(30).default(10) });
export type SearchInput = z.infer<typeof searchInputSchema>;
export type SocialAccount = { id: string; platform: Platform; url: string; username: string; name: string; followerCount: number | null };
export function searchUrl(input: SearchInput) {
  const query = encodeURIComponent(input.query);
  if (input.platform === "tiktok") return `https://www.tiktok.com/search${input.type === "accounts" ? "/user" : ""}?q=${query}`;
  if (input.platform === "instagram") return input.type === "accounts" ?
    `https://www.instagram.com/web/search/topsearch/?query=${query}` : `https://www.instagram.com/explore/search/keyword/?q=${query}`;
  return `https://www.youtube.com/results?search_query=${query}`;
}
