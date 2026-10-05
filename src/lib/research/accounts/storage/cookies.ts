import type { BrowserContext } from "playwright";
import type { AccountPlatform } from "../types";

export type AuthState = Awaited<ReturnType<BrowserContext["storageState"]>>;
const loginCookies: Record<AccountPlatform, string[]> = {
  tiktok: ["sessionid", "sessionid_ss"], instagram: ["sessionid"],
};
export function belongsToPlatform(domain: string, platform: AccountPlatform) {
  const hostname = domain.replace(/^\./, "").toLowerCase();
  return hostname === `${platform}.com` || hostname.endsWith(`.${platform}.com`);
}
export function loginCookie(state: AuthState, platform: AccountPlatform, now = Date.now()) {
  return state.cookies.find(cookie => loginCookies[platform].includes(cookie.name) && cookie.value &&
    belongsToPlatform(cookie.domain, platform) && (cookie.expires === -1 || cookie.expires * 1000 > now));
}
export function platformState(state: AuthState, platform: AccountPlatform): AuthState {
  return {
    cookies: state.cookies.filter(cookie => belongsToPlatform(cookie.domain, platform)),
    origins: state.origins.filter(origin => {
      try { const url = new URL(origin.origin); return url.protocol === "https:" && belongsToPlatform(url.hostname, platform); }
      catch { return false; }
    }),
  };
}
