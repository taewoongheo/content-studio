import assert from "node:assert/strict";
import test from "node:test";
import { accountHandlers } from "./http";
import type { AccountManager } from "./manager";
test("account management requires local same-origin mutations and returns only redacted status", async () => {
  let logins = 0;
  const handlers = accountHandlers({ list: () => [{ platform: "instagram", status: "disconnected" }],
    async startLogin() { logins++; } } as unknown as AccountManager);
  const request = (headers: Record<string, string>, body = '{"platform":"instagram","action":"login"}') => new Request("http://127.0.0.1:3000/api/research/accounts", {
    method: "POST", headers: { host: "127.0.0.1:3000", ...headers }, body,
  });
  assert.equal((await handlers.POST(request({ origin: "https://evil.example" }))).status, 403);
  assert.equal((await handlers.POST(request({ origin: "http://127.0.0.1:3000" }, '{"platform":"other","action":"login"}'))).status, 400);
  assert.equal(logins, 0);
  const response = await handlers.POST(request({ origin: "http://127.0.0.1:3000" }));
  assert.equal(response.status, 200); assert.equal(logins, 1); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { accounts: [{ platform: "instagram", status: "disconnected" }] });
});
