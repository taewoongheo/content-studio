import assert from "node:assert/strict";
import test from "node:test";
import type { Browser, BrowserContext, Page } from "playwright";
import { ResearchBrowsers } from "./sessions";

function fakeBrowser() {
  let browserCloses = 0, contextCloses = 0, contexts = 0, connected = true;
  const pages: Array<{ closed: boolean }> = [];
  const browser = {
    isConnected: () => connected,
    async newContext() {
      contexts++;
      const state = { closed: false }; pages.push(state);
      const page = { isClosed: () => state.closed, setDefaultTimeout() {}, setDefaultNavigationTimeout() {} } as unknown as Page;
      return { on() {}, async newPage() { return page; }, async storageState() { return { cookies: [], origins: [] }; },
        async close() { contextCloses++; state.closed = true; } } as unknown as BrowserContext;
    },
    async close() { browserCloses++; connected = false; },
  } as unknown as Browser;
  return { browser, counts: () => ({ browserCloses, contextCloses, contexts }), pages };
}
test("contexts share one browser, creation deduplicates, and the final close releases the process", async () => {
  const fake = fakeBrowser(); let launches = 0;
  const pool = new ResearchBrowsers(async () => { launches++; return fake.browser; });
  try {
    const [a, b] = await Promise.all([pool.page("a"), pool.page("a")]); assert.equal(a, b);
    await pool.page("b"); await pool.page("c");
    await assert.rejects(pool.page("d"), /existing research/);
    assert.equal(launches, 1); assert.equal(fake.counts().contexts, 3);
    await pool.close("a"); assert.equal(fake.counts().browserCloses, 0);
  } finally { await pool.closeAll(); }
  assert.deepEqual(fake.counts(), { browserCloses: 1, contextCloses: 3, contexts: 3 });
});
test("idle cleanup is independent of result polling and active work is protected", async () => {
  const fake = fakeBrowser(); const pool = new ResearchBrowsers(async () => fake.browser, undefined, 10);
  pool.hold("a"); await pool.page("a");
  await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(fake.counts().contextCloses, 0);
  pool.release("a");
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(fake.counts(), { browserCloses: 1, contextCloses: 1, contexts: 1 });
});
test("closing while launch is pending cannot leak a late-created context", async () => {
  const fake = fakeBrowser(); let resolve!: (browser: Browser) => void;
  const pool = new ResearchBrowsers(() => new Promise(done => { resolve = done; }));
  const creation = pool.page("a"), closing = pool.close("a");
  resolve(fake.browser); await Promise.all([creation, closing]);
  assert.equal(pool.peek("a"), undefined);
  assert.deepEqual(fake.counts(), { browserCloses: 1, contextCloses: 1, contexts: 1 });
});
test("failed page creation releases both context and browser", async () => {
  const fake = fakeBrowser();
  const original = fake.browser.newContext.bind(fake.browser);
  fake.browser.newContext = async options => { const context = await original(options); context.newPage = async () => { throw new Error("page failed"); }; return context; };
  const pool = new ResearchBrowsers(async () => fake.browser);
  await assert.rejects(pool.page("a"), /page failed/);
  assert.equal(pool.peek("a"), undefined);
  assert.deepEqual(fake.counts(), { browserCloses: 1, contextCloses: 1, contexts: 1 });
});
test("disconnect closes a platform context even while creation is pending", async () => {
  const fake = fakeBrowser(); let resolve!: (browser: Browser) => void;
  const pool = new ResearchBrowsers(() => new Promise(done => { resolve = done; }));
  const creation = pool.page("a", "instagram"), closing = pool.closePlatform("instagram");
  resolve(fake.browser); await Promise.all([creation, closing]);
  assert.equal(pool.peek("a"), undefined);
  assert.deepEqual(fake.counts(), { browserCloses: 1, contextCloses: 1, contexts: 1 });
});
