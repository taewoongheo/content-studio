import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountStore } from "./store";
import type { AuthState } from "./cookies";

const state = (expires: number): AuthState => ({ cookies: [{ name: "sessionid", value: "test-secret", domain: ".instagram.com", path: "/", expires,
  httpOnly: true, secure: true, sameSite: "None" }], origins: [] });
test("credentials survive a new store instance, expire, and never appear in public status", () => {
  const directory = mkdtempSync(join(tmpdir(), "research-auth-"));
  let now = 1_000_000;
  try {
    const store = new AccountStore(directory, () => now);
    assert.equal(store.status("instagram").status, "disconnected");
    assert.equal(store.save("instagram", state(1100)), true);
    assert.equal(new AccountStore(directory, () => now).status("instagram").status, "connected");
    assert.equal(JSON.stringify(store.list()).includes("test-secret"), false);
    assert.equal(statSync(join(directory, "instagram.json")).mode & 0o777, 0o600);
    now = 1_200_000;
    assert.equal(store.status("instagram").reason, "expired");
    assert.equal(store.load("instagram"), undefined);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test("foreign and anonymous cookies never establish login; stale browser writes cannot undo disconnect", () => {
  const directory = mkdtempSync(join(tmpdir(), "research-auth-"));
  try {
    const store = new AccountStore(directory);
    assert.equal(store.save("tiktok", state(-1)), false);
    assert.equal(store.save("instagram", state(-1)), true);
    const version = store.version("instagram");
    store.disconnect("instagram");
    assert.equal(store.save("instagram", state(-1), version), false);
    assert.equal(store.status("instagram").status, "disconnected");
    store.save("instagram", state(-1)); store.invalidate("instagram");
    assert.equal(store.status("instagram").reason, "rejected");
    assert.equal(store.load("instagram"), undefined);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
