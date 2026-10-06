import { randomUUID } from "node:crypto";
import { AccountStore } from "./storage/store";
import { accountPlatforms, accountUrls, type AccountPlatform } from "./types";
import { loginCookie } from "./storage/cookies";
import { ResearchBrowsers } from "../browser/sessions";
import { browserBlock } from "../browser/blocks";
import { CollectionBlocked } from "../collection/types";
import { importSafariState } from "./import/safari";
import { SafariImportError } from "./import/errors";

type Login = { id: string; timer: NodeJS.Timeout };
const LOGIN_TIMEOUT_MS = 10 * 60_000;
export class AccountManager {
  private logins = new Map<AccountPlatform, Login>();
  private changing = new Set<AccountPlatform>();
  private operations = new Map<AccountPlatform, { id: string; cancel: () => void }>();
  constructor(readonly store = new AccountStore(), readonly browsers = new ResearchBrowsers(undefined, store),
    private readonly safariReader = importSafariState) {}
  list() { return accountPlatforms.map(platform => this.status(platform)); }
  status(platform: AccountPlatform) {
    const login = this.logins.get(platform);
    const page = login && this.browsers.peek(login.id);
    if (login && (!page || page.isClosed())) {
      clearTimeout(login.timer); this.logins.delete(platform);
      void this.browsers.close(login.id).catch(() => undefined);
    }
    const status = this.store.status(platform);
    return this.logins.has(platform) ? { ...status, status: "logging_in" as const } : status;
  }
  require(platform: AccountPlatform) {
    if (this.status(platform).status !== "connected")
      throw new CollectionBlocked("login_required", `Connect ${platform} in Dashboard → Settings → Research accounts, then retry.`);
  }
  acquire(platform: AccountPlatform, id: string, cancel: () => void) {
    if (this.changing.has(platform) || this.logins.has(platform) || this.operations.has(platform))
      throw new CollectionBlocked("source_error", `Another ${platform} operation is active. Finish it before retrying.`);
    this.operations.set(platform, { id, cancel });
    return () => { if (this.operations.get(platform)?.id === id) this.operations.delete(platform); };
  }
  async startLogin(platform: AccountPlatform) {
    if (this.changing.has(platform) || this.operations.has(platform)) throw new Error("진행 중인 검색·수집이 끝난 뒤 로그인해 주세요.");
    const current = this.logins.get(platform);
    const page = current && this.browsers.peek(current.id);
    if (page && !page.isClosed()) { await page.bringToFront(); return this.status(platform); }
    this.changing.add(platform);
    const id = `login-${randomUUID()}`;
    try {
      await this.cancelLogin(platform);
      await this.browsers.closePlatform(platform);
      this.browsers.hold(id);
      const loginPage = await this.browsers.page(id);
      await loginPage.goto(accountUrls[platform], { waitUntil: "domcontentloaded" });
      await loginPage.bringToFront();
      const timer = setTimeout(() => { void this.cancelLogin(platform).catch(() => undefined); }, LOGIN_TIMEOUT_MS);
      timer.unref(); this.logins.set(platform, { id, timer });
      return this.status(platform);
    } catch {
      await this.browsers.close(id);
      throw new Error("로그인 브라우저를 열지 못했습니다. Chromium 설치와 네트워크를 확인해 주세요.");
    } finally { this.changing.delete(platform); }
  }
  async finishLogin(platform: AccountPlatform) {
    if (this.changing.has(platform)) throw new Error("계정 연결을 처리 중입니다. 잠시 후 다시 시도해 주세요.");
    this.changing.add(platform);
    try {
      const login = this.logins.get(platform);
      const page = login && this.browsers.peek(login.id);
      if (!login || !page || page.isClosed()) throw new Error("로그인 창을 다시 열어 주세요.");
      const state = await page.context().storageState();
      const block = await browserBlock(page);
      if (!loginCookie(state, platform) || block) throw new Error("브라우저에서 로그인과 인증을 완료한 뒤 눌러 주세요.");
      if (!this.store.save(platform, state)) throw new Error("로그인 상태를 저장하지 못했습니다. 다시 로그인해 주세요.");
      await this.cancelLogin(platform);
      return this.status(platform);
    } finally { this.changing.delete(platform); }
  }
  async cancelLogin(platform: AccountPlatform) {
    const login = this.logins.get(platform);
    if (!login) return;
    clearTimeout(login.timer); this.logins.delete(platform);
    await this.browsers.close(login.id);
  }
  async importSafari(platform: AccountPlatform) {
    if (this.changing.has(platform) || this.operations.has(platform) || this.logins.has(platform))
      throw new SafariImportError("busy");
    this.changing.add(platform);
    try {
      // Read and validate before closing contexts or replacing an existing connection.
      const state = await this.safariReader(platform);
      await this.browsers.closePlatform(platform);
      if (!this.store.save(platform, state)) throw new SafariImportError("cookies_missing");
      return this.status(platform);
    } finally { this.changing.delete(platform); }
  }
  async disconnect(platform: AccountPlatform) {
    if (this.changing.has(platform)) throw new Error("계정 연결을 처리 중입니다. 잠시 후 다시 시도해 주세요.");
    this.changing.add(platform);
    try {
      this.store.disconnect(platform); // Invalidate versions before any context can save old cookies.
      this.operations.get(platform)?.cancel(); this.operations.delete(platform);
      await this.cancelLogin(platform); await this.browsers.closePlatform(platform);
      return this.status(platform);
    } finally { this.changing.delete(platform); }
  }
  async rejected(platform: AccountPlatform) {
    this.store.invalidate(platform);
    await this.browsers.closePlatform(platform);
  }
}
