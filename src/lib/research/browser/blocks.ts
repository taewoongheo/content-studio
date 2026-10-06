import type { Page } from "playwright";
import { CollectionBlocked } from "../collection/types";

export async function browserBlock(page: Page, status?: number): Promise<CollectionBlocked | null> {
  const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 20_000).toLowerCase();
  const challenge = page.locator('[id*="captcha"], [class*="captcha_verify"], iframe[src*="captcha"]');
  for (let index = 0; index < Math.min(await challenge.count(), 12); index++) {
    if (await challenge.nth(index).isVisible())
      return new CollectionBlocked("captcha_required", "A visible CAPTCHA was detected. Keep this session for challenge handling.");
  }
  if (/verify (?:that )?you(?:'re| are) human|complete the captcha|drag the slider/.test(body))
    return new CollectionBlocked("captcha_required", "The page explicitly requests human verification.");
  if (status === 429) return new CollectionBlocked("rate_limited", "The source returned HTTP 429. Retry later.");
  if (/\/accounts\/login|\/login\/?(?:\?|$)/.test(page.url()))
    return new CollectionBlocked("login_required", "The source redirected to a login page.");
  if (status === 401 || status === 403) return new CollectionBlocked("access_denied", `The source returned HTTP ${status}; no CAPTCHA was confirmed.`);
  if (status === 404) return new CollectionBlocked("not_found", "The source returned HTTP 404.");
  return null;
}
