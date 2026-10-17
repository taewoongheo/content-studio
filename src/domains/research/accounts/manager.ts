import { AccountStore } from "@/domains/research/accounts/storage/store";
import { accountPlatforms, type AccountPlatform } from "@/domains/research/accounts/types";
import { ResearchBrowsers } from "@/domains/research/browser/sessions";
import { CollectionBlocked } from "@/domains/research/collection/types";
import { importSafariState } from "@/domains/research/accounts/import/safari";
import { SafariImportError } from "@/domains/research/accounts/import/errors";
import { openSafariLogin } from "@/domains/research/accounts/import/launch";

type Login = { timer: NodeJS.Timeout };
const LOGIN_TIMEOUT_MS = 10 * 60_000;
export class AccountManager {
  private logins = new Map<AccountPlatform, Login>();
  private changing = new Set<AccountPlatform>();
  private operations = new Map<AccountPlatform, { id: string; cancel: () => void }>();
  constructor(readonly store = new AccountStore(), readonly browsers = new ResearchBrowsers(undefined, store),
    private readonly safariReader = importSafariState, private readonly safariOpener = openSafariLogin) {}
  list() { return accountPlatforms.map(platform => this.status(platform)); }
  status(platform: AccountPlatform) {
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
    if (this.changing.has(platform) || this.operations.has(platform)) throw new SafariImportError("busy");
    this.changing.add(platform);
    try {
      await this.safariOpener(platform);
      await this.cancelLogin(platform);
      const timer = setTimeout(() => { void this.cancelLogin(platform); }, LOGIN_TIMEOUT_MS);
      timer.unref(); this.logins.set(platform, { timer });
      return this.status(platform);
    } finally { this.changing.delete(platform); }
  }
  async finishLogin(platform: AccountPlatform) {
    return this.importSafari(platform);
  }
  async cancelLogin(platform: AccountPlatform) {
    const login = this.logins.get(platform);
    if (!login) return;
    clearTimeout(login.timer); this.logins.delete(platform);
  }
  async importSafari(platform: AccountPlatform) {
    if (this.changing.has(platform) || this.operations.has(platform))
      throw new SafariImportError("busy");
    this.changing.add(platform);
    try {
      // Read and validate before closing contexts or replacing an existing connection.
      const state = await this.safariReader(platform);
      await this.browsers.closePlatform(platform);
      if (!this.store.save(platform, state)) throw new SafariImportError("cookies_missing");
      await this.cancelLogin(platform);
      return this.status(platform);
    } finally { this.changing.delete(platform); }
  }
  async disconnect(platform: AccountPlatform) {
    if (this.changing.has(platform)) throw new SafariImportError("busy");
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
