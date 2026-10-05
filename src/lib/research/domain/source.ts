import type { Platform } from "./schema";

export function socialSource(raw: string, kind: "post" | "account") {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new Error("Use a public HTTPS platform URL without credentials or a custom port.");
  const hosts: Record<string, Platform> = {
    "instagram.com": "instagram", "www.instagram.com": "instagram",
    "tiktok.com": "tiktok", "www.tiktok.com": "tiktok",
    "youtube.com": "youtube", "www.youtube.com": "youtube",
  };
  const platform = hosts[url.hostname];
  if (!platform) throw new Error("Only Instagram, TikTok and YouTube URLs are supported.");
  const patterns = {
    instagram: { post: /^\/(?:p|reel)\/([A-Za-z0-9_-]+)\/?$/, account: /^\/([A-Za-z0-9_.]+)\/?$/ },
    tiktok: { post: /^\/@[A-Za-z0-9_.]+\/(?:photo|video)\/(\d+)\/?$/, account: /^\/@([A-Za-z0-9_.]+)\/?$/ },
    youtube: { post: /^\/post\/([A-Za-z0-9_-]+)\/?$/, account: /^\/(?:@([A-Za-z0-9_.-]+)|channel\/(UC[A-Za-z0-9_-]+))(?:\/(?:posts|community))?\/?$/ },
  };
  const match = url.pathname.match(patterns[platform][kind]);
  if (!match) throw new Error(`Use a canonical ${platform} ${kind} URL; short links are not supported.`);
  url.search = ""; url.hash = "";
  return { platform, id: match[1] || match[2], url: url.toString().replace(/\/$/, "") };
}

export function isMediaUrl(raw: string) {
  try {
    const url = new URL(raw);
    const domains = ["cdninstagram.com", "fbcdn.net", "tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "ibytedtos.com", "byteoversea.com", "ytimg.com", "ggpht.com", "googleusercontent.com"];
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}
