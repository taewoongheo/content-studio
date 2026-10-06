import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSafariState } from "./safari";
import { SafariImportError } from "./errors";
import { AccountManager } from "../manager";
import { AccountStore } from "../storage/store";
import { ResearchBrowsers } from "../../browser/sessions";
import type { AuthState } from "../storage/cookies";

const state: AuthState = { cookies: [{ name: "sessionid", value: "synthetic-safari-secret", domain: ".instagram.com", path: "/",
  expires: -1, httpOnly: true, secure: true, sameSite: "Lax" }], origins: [] };
test("login opens Safari and completion imports cookies; failed completion keeps the login retryable", async () => {
  const directory = mkdtempSync(join(tmpdir(), "safari-login-"));
  let opens = 0, permitted = false;
  const browsers = { async closePlatform() {} } as unknown as ResearchBrowsers;
  const accounts = new AccountManager(new AccountStore(directory), browsers, async () => {
    if (!permitted) throw new SafariImportError("permission_required"); return state;
  }, async platform => { assert.equal(platform, "instagram"); opens++; });
  try {
    assert.equal((await accounts.startLogin("instagram")).status, "logging_in"); assert.equal(opens, 1);
    assert.throws(() => accounts.acquire("instagram", "job", () => undefined));
    await assert.rejects(accounts.finishLogin("instagram"), SafariImportError);
    assert.equal(accounts.status("instagram").status, "logging_in");
    permitted = true;
    assert.equal((await accounts.finishLogin("instagram")).status, "connected");
    assert.equal(accounts.status("instagram").status, "connected");
    await accounts.startLogin("instagram"); await accounts.cancelLogin("instagram");
    assert.equal(accounts.status("instagram").status, "connected");
  } finally { await accounts.cancelLogin("instagram"); rmSync(directory, { recursive: true, force: true }); }
});
test("Safari imports filter unrelated domains, reject expired sessions, and sanitize errors", () => {
  const cookies = [...state.cookies, { ...state.cookies[0], domain: ".instagram.com.attacker.example" }];
  assert.deepEqual(parseSafariState(JSON.stringify({ ok: true, cookies }), "instagram"), state);
  assert.throws(() => parseSafariState(JSON.stringify({ ok: true, cookies }), "tiktok"), error => error instanceof SafariImportError && error.reason === "cookies_missing");
  assert.throws(() => parseSafariState(JSON.stringify({ ok: true, cookies: [{ ...state.cookies[0], expires: 1 }] }), "instagram"), SafariImportError);
  for (const raw of ["synthetic-safari-secret", JSON.stringify({ ok: false, reason: "synthetic-safari-secret" })]) {
    assert.throws(() => parseSafariState(raw, "instagram"), error => error instanceof SafariImportError && !error.message.includes("synthetic-safari-secret"));
  }
});
test("Safari import replaces stored session after closing contexts; failures preserve existing connection", async () => {
  const directory = mkdtempSync(join(tmpdir(), "safari-import-"));
  try {
    const store = new AccountStore(directory); let closes = 0;
    const browsers = { async closePlatform() { closes++; } } as unknown as ResearchBrowsers;
    const accounts = new AccountManager(store, browsers, async () => state);
    const release = accounts.acquire("instagram", "busy-job", () => undefined);
    await assert.rejects(accounts.importSafari("instagram"), error => error instanceof SafariImportError && error.reason === "busy");
    assert.equal(closes, 0); release();
    assert.equal((await accounts.importSafari("instagram")).status, "connected");
    assert.equal(closes, 1); assert.deepEqual(store.load("instagram"), state);
    assert.equal(JSON.stringify(accounts.list()).includes("synthetic-safari-secret"), false);
    const failing = new AccountManager(store, browsers, async () => { throw new SafariImportError("permission_required"); });
    await assert.rejects(failing.importSafari("instagram"), SafariImportError);
    assert.equal(closes, 1); assert.deepEqual(store.load("instagram"), state);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test("Safari import excludes overlapping connection changes and releases the lock after failure", async () => {
  const directory = mkdtempSync(join(tmpdir(), "safari-import-lock-"));
  try {
    let fail!: (error: Error) => void;
    const accounts = new AccountManager(new AccountStore(directory), {} as ResearchBrowsers,
      () => new Promise((_resolve, reject) => { fail = reject; }));
    const importing = accounts.importSafari("instagram");
    await assert.rejects(accounts.importSafari("instagram"), SafariImportError);
    assert.throws(() => accounts.acquire("instagram", "job", () => undefined));
    await assert.rejects(accounts.disconnect("instagram"));
    fail(new SafariImportError("source_error")); await assert.rejects(importing);
    accounts.acquire("instagram", "next-job", () => undefined)();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
