import assert from "node:assert/strict";
import test from "node:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AuthState } from "../../accounts/storage/cookies";
import { collectInstagram } from "./instagram";
import { socialSource } from "../../domain/source";
test("Instagram worker cookies stay private and renew through the credential callback", async () => {
  const directory = await mkdtemp(join(tmpdir(), "studio-worker-test-")), executable = join(directory, "worker");
  const previous = process.env.CONTENT_STUDIO_RESEARCH_PYTHON;
  try {
    await writeFile(executable, `#!/usr/bin/env python3
import json, sys
request = json.load(sys.stdin)
assert request["cookies"][0]["value"] == "fixture-secret"
request["cookies"][0]["value"] = "renewed-secret"
print(json.dumps({"ok": True, "posts": [], "hasMore": False, "cookies": request["cookies"]}))
`); await chmod(executable, 0o700); process.env.CONTENT_STUDIO_RESEARCH_PYTHON = executable;
    let saved: AuthState | undefined;
    const authState: AuthState = { cookies: [{ name: "sessionid", value: "fixture-secret", domain: ".instagram.com", path: "/", expires: -1,
      secure: true, httpOnly: true, sameSite: "None" }], origins: [] };
    const result = await collectInstagram({ source: socialSource("https://www.instagram.com/p/ABC/", "post"), kind: "post", limit: 1 }, {
      sessionId: "test", signal: new AbortController().signal, authState, persistAuthState: state => { saved = state; },
      getPage: async () => { throw new Error("HTTP collection must not open a browser"); },
    });
    assert.equal(saved?.cookies[0].value, "renewed-secret");
    assert.equal(JSON.stringify(result).includes("secret"), false);
    assert.deepEqual(result, { posts: [], nextCursor: null, warnings: [] });
  } finally {
    if (previous === undefined) delete process.env.CONTENT_STUDIO_RESEARCH_PYTHON; else process.env.CONTENT_STUDIO_RESEARCH_PYTHON = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
