import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import * as z from "zod/v4";
import { researchRuntimeDirectory } from "../../runtime";
import { loginCookie, platformState, storedCookieSchema, type AuthState } from "./cookies";
import { accountPlatforms, type AccountPlatform, type AccountStatus } from "../types";

const storedSchema = z.object({ updatedAt: z.iso.datetime(), reason: z.enum(["rejected", "invalid"]).nullable(),
  state: z.object({ cookies: z.array(storedCookieSchema).max(1000),
    origins: z.array(z.object({ origin: z.string(), localStorage: z.array(z.object({ name: z.string(), value: z.string() })) })).max(100) }).nullable() });
type Stored = z.infer<typeof storedSchema>;

/** Local credentials never enter the project DB, API responses, logs or Git. */
export class AccountStore {
  private generations = new Map<AccountPlatform, number>();
  constructor(private directory = join(researchRuntimeDirectory(), "accounts"), private now = Date.now) {}
  version(platform: AccountPlatform) { return this.generations.get(platform) ?? 0; }
  private path(platform: AccountPlatform) { return join(this.directory, `${platform}.json`); }
  private read(platform: AccountPlatform): Stored | undefined {
    const file = this.path(platform);
    if (!existsSync(file)) return;
    try {
      const bytes = readFileSync(file);
      if (bytes.byteLength > 2_000_000) throw new Error("size");
      return storedSchema.parse(JSON.parse(bytes.toString("utf8")));
    } catch { return { updatedAt: new Date(this.now()).toISOString(), state: null, reason: "invalid" }; }
  }
  private write(platform: AccountPlatform, value: Stored) {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    chmodSync(this.directory, 0o700);
    const file = this.path(platform), temporary = `${file}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(value), { mode: 0o600, flag: "wx" });
      renameSync(temporary, file); chmodSync(file, 0o600);
    } finally { rmSync(temporary, { force: true }); }
  }
  status(platform: AccountPlatform): AccountStatus {
    const saved = this.read(platform);
    const cookie = saved?.state && loginCookie(saved.state, platform, this.now());
    return { platform, status: !saved ? "disconnected" : cookie && !saved.reason ? "connected" : "login_required",
      reason: !saved ? "missing" : saved.reason ?? (cookie ? null : "expired"),
      expiresAt: cookie && cookie.expires !== -1 ? new Date(cookie.expires * 1000).toISOString() : null,
      updatedAt: saved?.updatedAt ?? null };
  }
  list() { return accountPlatforms.map(platform => this.status(platform)); }
  load(platform: AccountPlatform): AuthState | undefined {
    if (this.status(platform).status !== "connected") return;
    return this.read(platform)?.state ?? undefined;
  }
  save(platform: AccountPlatform, state: AuthState, expectedVersion = this.version(platform)) {
    if (expectedVersion !== this.version(platform)) return false;
    const filtered = platformState(state, platform);
    if (!loginCookie(filtered, platform, this.now())) return false;
    this.write(platform, { state: filtered, reason: null, updatedAt: new Date(this.now()).toISOString() });
    return true;
  }
  invalidate(platform: AccountPlatform) {
    this.generations.set(platform, this.version(platform) + 1);
    this.write(platform, { state: null, reason: "rejected", updatedAt: new Date(this.now()).toISOString() });
  }
  disconnect(platform: AccountPlatform) {
    this.generations.set(platform, this.version(platform) + 1);
    rmSync(this.path(platform), { force: true });
  }
}
