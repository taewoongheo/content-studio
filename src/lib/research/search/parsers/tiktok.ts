import { normalizeTikTok } from "../../collectors/tiktok";
import type { SocialPost } from "../../domain/schema";
import type { SocialAccount } from "../types";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value && typeof value === "object" ? value as ObjectValue : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const count = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

export function parseTikTokSearch(payload: unknown) {
  const data = object(payload);
  const rawUsers = array(data.user_list).map(value => object(value).user_info ?? object(value).user ?? value);
  const rawItems = [...array(data.item_list), ...array(data.itemList), ...array(data.data).flatMap(value => {
    const row = object(value); return row.item ? [row.item] : row.item_list ? array(row.item_list) : [];
  })];
  const accounts: SocialAccount[] = rawUsers.flatMap(value => {
    const user = object(value); const username = text(user.unique_id ?? user.uniqueId);
    if (!/^[A-Za-z0-9_.]+$/.test(username)) return [];
    return [{ id: String(user.uid ?? user.id ?? username), platform: "tiktok", username,
      name: text(user.nickname), url: `https://www.tiktok.com/@${username}`,
      followerCount: count(user.follower_count ?? user.followerCount) }];
  });
  const posts: SocialPost[] = rawItems.flatMap(value => {
    const item = object(value), author = object(item.author ?? item.author_info);
    const username = text(author.uniqueId ?? author.unique_id), id = String(item.id ?? item.id_str ?? "");
    if (!/^\d+$/.test(id) || !/^[A-Za-z0-9_.]+$/.test(username)) return [];
    const images = array(object(item.imagePost).images);
    const normalized = { ...item, id_str: id, author_info: { unique_id: username },
      statistics_info: item.statistics_info ?? { digg_count: object(item.stats).diggCount, comment_count: object(item.stats).commentCount,
        share_count: object(item.stats).shareCount, play_count: object(item.stats).playCount, collect_count: object(item.stats).collectCount },
      image_post_info: item.image_post_info ?? (images.length ? { images: images.map(image => ({ display_image: {
        url_list: array(object(object(image).imageURL).urlList), width: object(image).imageWidth, height: object(image).imageHeight,
      } })) } : undefined),
    };
    const photo = images.length || array(object(item.image_post_info).images).length;
    try { return [normalizeTikTok(normalized, `https://www.tiktok.com/@${username}/${photo ? "photo" : "video"}/${id}`)]; }
    catch { return []; }
  });
  return { accounts, posts, recognized: Array.isArray(data.user_list) || Array.isArray(data.item_list) || Array.isArray(data.itemList) || Array.isArray(data.data) };
}
