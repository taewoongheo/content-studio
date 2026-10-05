import { chromium, type Browser, type Page } from "playwright";
import { CollectionBlocked } from "../collection/types";

type Session = { browser: Browser; page: Page };
export class ResearchBrowsers {
  private sessions = new Map<string, Session>();
  private pending = new Map<string, Promise<Page>>();
  constructor(private launch: () => Promise<Browser> = () => chromium.launch({ headless: false })) {}
  async page(id: string) {
    const existing = this.sessions.get(id);
    if (existing && !existing.page.isClosed()) return existing.page;
    const pending = this.pending.get(id);
    if (pending) return pending;
    if (this.sessions.size + this.pending.size - (existing ? 1 : 0) >= 3)
      throw new CollectionBlocked("source_error", "Close an existing collection session before opening another browser.");
    const creation = this.create(id);
    this.pending.set(id, creation);
    try { return await creation; } finally { this.pending.delete(id); }
  }
  private async create(id: string) {
    // A dedicated visible browser can be operated by native computer use without
    // replacing the collection session. Never open a user's existing profile.
    const existing = this.sessions.get(id);
    if (existing) {
      await existing.browser.close();
      this.sessions.delete(id);
    }
    let browser: Browser;
    try { browser = await this.launch(); }
    catch { throw new CollectionBlocked("setup_required", "Install the Playwright Chromium browser: pnpm exec playwright install chromium"); }
    let page: Page;
    try {
      const context = await browser.newContext();
      page = await context.newPage();
    } catch (error) {
      await browser.close().catch(() => undefined);
      throw error;
    }
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(20_000);
    this.sessions.set(id, { browser, page });
    return page;
  }
  peek(id: string) { return this.sessions.get(id)?.page; }
  async close(id: string) {
    const pending = this.pending.get(id);
    if (pending) await pending.catch(() => undefined);
    const session = this.sessions.get(id);
    this.sessions.delete(id);
    await session?.browser.close();
  }
}

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
  if (status === 401 || status === 403) return new CollectionBlocked("access_denied", `The source returned HTTP ${status}; no CAPTCHA was confirmed.`);
  if (/\/accounts\/login|\/login\/?(?:\?|$)/.test(page.url()))
    return new CollectionBlocked("login_required", "The source redirected to a login page.");
  if (status === 404) return new CollectionBlocked("not_found", "The source returned HTTP 404.");
  return null;
}
