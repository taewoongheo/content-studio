import { normalizeTikTokUrl } from "./client";

const hosts = new Set(["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);
function publicTikTokUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("올바른 TikTok 게시물 URL을 입력해 주세요."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hosts.has(url.hostname))
    throw new Error("현재 게시 완료는 TikTok 게시물 URL만 지원합니다.");
  return url;
}

/** Resolve only TikTok-owned redirects; never follow an arbitrary external destination. */
export async function resolveTikTokPostUrl(raw: string, transport: typeof fetch = fetch) {
  let url = publicTikTokUrl(raw.trim());
  const signal = AbortSignal.timeout(15_000);
  for (let hop = 0; hop < 5; hop++) {
    try { return normalizeTikTokUrl(url.href); } catch { /* Resolve supported sharing links below. */ }
    if (!((url.hostname === "vm.tiktok.com" || url.hostname === "vt.tiktok.com") && /^\/[A-Za-z0-9]+\/?$/.test(url.pathname)) &&
      !((url.hostname === "www.tiktok.com" || url.hostname === "tiktok.com") && /^\/t\/[A-Za-z0-9]+\/?$/.test(url.pathname))) break;
    const response = await transport(url, { redirect: "manual", signal, cache: "no-store" });
    await response.body?.cancel();
    const location = response.headers.get("location");
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) break;
    url = publicTikTokUrl(new URL(location, url).href);
  }
  throw new Error("TikTok 단축 링크를 확인하지 못했습니다. 브라우저에서 게시물을 연 뒤 전체 주소를 복사해 주세요.");
}
