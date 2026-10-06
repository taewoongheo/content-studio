import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { CollectionBlocked } from "../collection/types";
import type { AuthState } from "../accounts/storage/cookies";
import type { AccountPlatform } from "../accounts/types";

type Session = { context: BrowserContext; page: Page; platform?: AccountPlatform; version: number; active: boolean; timer?: NodeJS.Timeout };
type Credentials = { load(platform: AccountPlatform): AuthState | undefined; version(platform: AccountPlatform): number;
  save(platform: AccountPlatform, state: AuthState, version: number): boolean };
const IDLE_MS = 60_000;
const CHALLENGE_IDLE_MS = 5 * 60_000;
const MAX_CONTEXTS = 3;

/** One Chromium process, bounded contexts, and no browser kept alive by result polling. */
export class ResearchBrowsers {
  private browser?: Browser;
  private launching?: Promise<Browser>;
  private sessions = new Map<string, Session>();
  private pending = new Map<string, Promise<Page>>();
  private closing = new Map<string, Promise<void>>();
  private platforms = new Map<string, AccountPlatform>();
  private holds = new Set<string>();
  constructor(private launch: () => Promise<Browser> = () => chromium.launch({ headless: false }),
    private credentials?: Credentials, private idleMs = IDLE_MS) {}
  async page(id: string, platform?: AccountPlatform, anonymous = false) {
    if (this.closing.has(id)) throw new CollectionBlocked("source_error", "This browser session is closing.");
    const existing = this.sessions.get(id);
    if (existing && !existing.page.isClosed()) { this.touch(existing); return existing.page; }
    const pending = this.pending.get(id);
    if (pending) return pending;
    if (this.sessions.size + this.pending.size - (existing ? 1 : 0) >= MAX_CONTEXTS)
      throw new CollectionBlocked("source_error", "Finish or close an existing research browser before opening another.");
    if (platform) this.platforms.set(id, platform);
    const creation = this.create(id, platform, anonymous);
    this.pending.set(id, creation);
    try { return await creation; }
    finally { this.pending.delete(id); if (!this.sessions.has(id)) this.platforms.delete(id); await this.closeBrowserIfUnused(); }
  }
  private async getBrowser() {
    if (this.browser?.isConnected()) return this.browser;
    this.launching ??= this.launch().then(browser => { this.browser = browser; return browser; });
    try { return await this.launching; }
    catch { throw new CollectionBlocked("setup_required", "Install Chromium with pnpm exec playwright install chromium."); }
    finally { this.launching = undefined; }
  }
  private async create(id: string, platform?: AccountPlatform, anonymous = false) {
    const existing = this.sessions.get(id);
    if (existing) { clearTimeout(existing.timer); await existing.context.close().catch(() => undefined); this.sessions.delete(id); }
    const version = platform ? this.credentials?.version(platform) ?? 0 : 0;
    const storageState = platform && !anonymous ? this.credentials?.load(platform) : undefined;
    const browser = await this.getBrowser();
    let context: BrowserContext | undefined;
    try {
      context = await browser.newContext({ storageState });
      const page = await context.newPage();
      page.setDefaultTimeout(10_000); page.setDefaultNavigationTimeout(20_000);
      const session: Session = { context, page, platform, version, active: this.holds.has(id) };
      context.on("page", extra => { if (context!.pages().length > 3) void extra.close().catch(() => undefined); });
      this.sessions.set(id, session); this.touch(session);
      return page;
    } catch (error) { await context?.close().catch(() => undefined); throw error; }
  }
  private touch(session: Session, delay = this.idleMs) {
    clearTimeout(session.timer);
    if (session.active) return;
    const id = [...this.sessions].find(([, value]) => value === session)?.[0];
    if (!id) return;
    session.timer = setTimeout(() => { void this.close(id).catch(() => undefined); }, delay);
    session.timer.unref();
  }
  hold(id: string) {
    this.holds.add(id);
    const session = this.sessions.get(id);
    if (session) { session.active = true; clearTimeout(session.timer); }
  }
  release(id: string, challenge = false) {
    this.holds.delete(id);
    const session = this.sessions.get(id);
    if (session) { session.active = false; this.touch(session, challenge ? CHALLENGE_IDLE_MS : this.idleMs); }
  }
  peek(id: string) { return this.sessions.get(id)?.page; }
  async save(id: string) {
    const session = this.sessions.get(id);
    if (session?.platform && this.credentials)
      return this.credentials.save(session.platform, await session.context.storageState(), session.version);
    return false;
  }
  close(id: string): Promise<void> {
    const pendingClose = this.closing.get(id);
    if (pendingClose) return pendingClose;
    this.holds.delete(id);
    const closing = this.dispose(id).finally(() => this.closing.delete(id));
    this.closing.set(id, closing);
    return closing;
  }
  private async dispose(id: string) {
    await this.pending.get(id)?.catch(() => undefined);
    const session = this.sessions.get(id);
    this.sessions.delete(id); this.platforms.delete(id);
    if (session) {
      clearTimeout(session.timer);
      try {
        if (session.platform && this.credentials)
          this.credentials.save(session.platform, await session.context.storageState(), session.version);
      } catch { /* A closed or rejected session must still release its browser. */ }
      finally { await session.context.close().catch(() => undefined); }
    }
    await this.closeBrowserIfUnused();
  }
  async closePlatform(platform: AccountPlatform) {
    await Promise.all([...this.platforms].filter(([, value]) => value === platform).map(([id]) => this.close(id)));
  }
  async closeAll() {
    await Promise.all([...new Set([...this.sessions.keys(), ...this.pending.keys()])].map(id => this.close(id)));
  }
  private async closeBrowserIfUnused() {
    if (this.sessions.size || this.pending.size || !this.browser) return;
    const browser = this.browser; this.browser = undefined;
    await browser.close().catch(() => undefined);
  }
}
