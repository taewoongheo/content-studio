import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { AccountStore } from "../../src/lib/research/accounts/storage/store";
import { AccountManager } from "../../src/lib/research/accounts/manager";
import { ResearchBrowsers } from "../../src/lib/research/browser/sessions";
import { searchTikTok } from "../../src/lib/research/search/platforms/tiktok";
import { searchInstagram } from "../../src/lib/research/search/platforms/instagram";
const directory = await mkdtemp(join(tmpdir(), "studio-search-fixture-"));
const launched: Browser[] = [];
let rejectSession = false;
const store = new AccountStore(directory);
const browsers = new ResearchBrowsers(async () => {
  const browser = await chromium.launch({ headless: true }); launched.push(browser);
  const create = browser.newContext.bind(browser);
  browser.newContext = async options => {
    const context = await create(options);
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/search/user/")) return route.fulfill({ contentType: "application/json", body: JSON.stringify({
        user_list: [{ user_info: { uid: "42", unique_id: "trainer", nickname: "Trainer" } }],
      }) });
      if (url.pathname.startsWith("/api/search/")) return route.fulfill({ contentType: "application/json", body: JSON.stringify({
        data: [{ item: { id: "123", author: { uniqueId: "trainer" }, desc: "Workout", stats: { playCount: 123456 } } }],
      }) });
      if (url.pathname === "/web/search/topsearch/") return route.fulfill({ status: rejectSession ? 401 : 200, contentType: "application/json",
        body: JSON.stringify(rejectSession ? { message: "login_required" } : { users: [{ user: { username: "trainer", pk: "42", full_name: "Trainer" } }] }) });
      if (url.pathname === "/api/graphql/") return route.fulfill({ contentType: "application/json", body: JSON.stringify({
        data: { xdt_api__v1__fbsearch__web__top_serp: { media_grid: { sections: [{ media: { code: "ABC", media_type: 1,
          user: { username: "trainer" }, caption: { text: "Workout" }, image_versions2: { candidates: [{ url: "https://cdn.cdninstagram.com/a.jpg" }] } } }] } } },
      }) });
      const script = url.pathname === "/search/user" ? '<script>fetch("/api/search/user/?keyword=fitness")</script>' :
        url.pathname === "/explore/search/keyword/" ? '<script>fetch("/api/graphql/", {method:"POST"})</script>' : url.pathname === "/search" ? '<script>fetch("/api/search/general/full/?keyword=fitness")</script>' : "";
      return route.fulfill({ contentType: "text/html", body: `<html><body>Fixture ${script}</body></html>` });
    });
    return context;
  };
  return browser;
}, store, 25);
const accounts = new AccountManager(store, browsers, async platform => ({ cookies: [{ name: "sessionid", value: "fixture-session", domain: `.${platform}.com`, path: "/", expires: -1,
  httpOnly: true, secure: true, sameSite: "Lax" }], origins: [] }), async () => undefined);
try {
  // Simulate Safari login/import, then exercise actual Chromium cookie restoration.
  await accounts.startLogin("tiktok");
  assert.equal(launched.length, 0);
  await accounts.finishLogin("tiktok");
  assert.equal(store.status("tiktok").status, "connected");
  assert.equal(launched.length, 0);
  for (let cycle = 0; cycle < 3; cycle++) {
    const id = `fixture-${cycle}`; browsers.hold(id);
    const type = cycle === 1 ? "accounts" : "posts";
    const result = await searchTikTok({ platform: "tiktok", query: "fitness", type, limit: 5 }, {
      sessionId: id, signal: new AbortController().signal, getPage: () => browsers.page(id, "tiktok"),
    });
    if (type === "posts") assert.equal(result.posts[0].metrics.viewCount, 123456);
    else assert.equal(result.accounts[0].username, "trainer");
    const cookies = await browsers.peek(id)!.context().cookies();
    assert.equal(cookies.some(cookie => cookie.name === "sessionid" && cookie.value === "fixture-session"), true);
    browsers.release(id);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(browsers.peek(id), undefined);
    assert.equal(launched.at(-1)!.isConnected(), false);
  }
  store.save("instagram", { cookies: [{ name: "sessionid", value: "fixture-session", domain: ".instagram.com", path: "/", expires: -1,
    secure: true, httpOnly: true, sameSite: "None" }], origins: [] });
  for (const rejected of [false, true]) {
    rejectSession = rejected; const id = `instagram-${rejected}`; browsers.hold(id);
    const operation = () => searchInstagram({ platform: "instagram", query: "fitness", type: "accounts", limit: 5 }, {
      sessionId: id, signal: new AbortController().signal, getPage: () => browsers.page(id, "instagram"),
    });
    if (rejected) await assert.rejects(operation(), error => error instanceof Error && "reason" in error && error.reason === "login_required");
    else assert.equal((await operation()).accounts[0].username, "trainer");
    browsers.release(id); await browsers.close(id);
  }
  const id = "instagram-posts"; browsers.hold(id);
  const posts = await searchInstagram({ platform: "instagram", query: "fitness", type: "posts", limit: 5 }, {
    sessionId: id, signal: new AbortController().signal, getPage: () => browsers.page(id, "instagram"),
  });
  assert.equal(posts.posts[0].text, "Workout"); browsers.release(id); await browsers.close(id);
  await accounts.startLogin("instagram"); await accounts.cancelLogin("instagram");
  assert.equal(launched.at(-1)!.isConnected(), false);
  await accounts.disconnect("tiktok"); assert.equal(store.status("tiktok").status, "disconnected");
  console.log("PASS synthetic Safari login, Chromium cookie restore, native result parsing, rejected-session classification and repeated idle process cleanup");
  console.log("Browsers launched:", launched.length, "remaining connected:", launched.filter(browser => browser.isConnected()).length);
} finally { await browsers.closeAll(); await rm(directory, { recursive: true, force: true }); }
