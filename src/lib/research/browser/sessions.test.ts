import assert from "node:assert/strict";
import test from "node:test";
import type { Browser, Page } from "playwright";
import { ResearchBrowsers } from "./sessions";

function fakeBrowser(failAt?: "context" | "page") {
  let closed = false, closes = 0;
  const page = { isClosed: () => closed, setDefaultTimeout() {}, setDefaultNavigationTimeout() {} } as unknown as Page;
  const browser = {
    async newContext() {
      if (failAt === "context") throw new Error("context failed");
      return { async newPage() { if (failAt === "page") throw new Error("page failed"); return page; } };
    },
    async close() { closes++; closed = true; },
  } as unknown as Browser;
  return { browser, page, closePage: () => { closed = true; }, closes: () => closes };
}

test("failed context or page initialization closes the launched browser and allows retry", async () => {
  for (const failAt of ["context", "page"] as const) {
    const failed = fakeBrowser(failAt), recovered = fakeBrowser();
    let launches = 0;
    const sessions = new ResearchBrowsers(async () => launches++ === 0 ? failed.browser : recovered.browser);
    await assert.rejects(sessions.page("a"), new RegExp(`${failAt} failed`));
    assert.equal(failed.closes(), 1);
    assert.equal(sessions.peek("a"), undefined);
    assert.equal(await sessions.page("a"), recovered.page);
    await sessions.close("a");
    assert.equal(recovered.closes(), 1);
  }
});

test("replacing a closed page closes its browser even when all three slots are occupied", async () => {
  const resources = Array.from({ length: 4 }, () => fakeBrowser());
  let launches = 0;
  const sessions = new ResearchBrowsers(async () => resources[launches++].browser);
  for (const id of ["a", "b", "c"]) await sessions.page(id);
  await assert.rejects(sessions.page("d"), /Close an existing/);
  resources[0].closePage();
  const [first, second] = await Promise.all([sessions.page("a"), sessions.page("a")]);
  assert.equal(first, resources[3].page); assert.equal(second, first);
  assert.equal(resources[0].closes(), 1); assert.equal(launches, 4);
  for (const id of ["a", "b", "c"]) await sessions.close(id);
  assert.deepEqual(resources.map(resource => resource.closes()), [1, 1, 1, 1]);
});
