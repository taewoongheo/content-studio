import test from "node:test";
import assert from "node:assert/strict";
import { resolveTikTokPostUrl } from "./post-url";

test("TikTok sharing links resolve to canonical post URLs without forwarding tracking queries", async () => {
  const calls: string[] = [];
  const transport: typeof fetch = async (url, options) => {
    calls.push(String(url));
    assert.equal(options?.redirect, "manual");
    return new Response(null, { status: 302, headers: { location: calls.length === 1
      ? "https://www.tiktok.com/t/ZABC/" : "https://www.tiktok.com/@creator/photo/123?track=1" } });
  };
  const result = await resolveTikTokPostUrl("https://vm.tiktok.com/ZPLDJtULU/", transport);
  assert.equal(result.url, "https://www.tiktok.com/@creator/photo/123");
  assert.equal(result.platform, "tiktok");
  assert.equal(calls.length, 2);
  await resolveTikTokPostUrl(result.url, async () => { throw new Error("Canonical URLs need no redirect lookup"); });
});

test("TikTok resolver rejects external redirects, credentials, ports and endless redirects", async () => {
  for (const location of ["https://instagram.com/p/test", "http://127.0.0.1", "https://tiktok.com.evil.test/", "https://user@www.tiktok.com/@a/photo/1", "https://www.tiktok.com:8443/@a/photo/1"]) {
    let calls = 0;
    await assert.rejects(resolveTikTokPostUrl("https://vt.tiktok.com/ZABC/", async () => {
      calls++; return new Response(null, { status: 302, headers: { location } });
    }), /TikTok/);
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(resolveTikTokPostUrl("https://vm.tiktok.com/ABC/", async () => {
    calls++; return new Response(null, { status: 302, headers: { location: "/ABC/" } });
  }), /단축 링크/);
  assert.equal(calls, 5);
  await assert.rejects(resolveTikTokPostUrl("https://vm.tiktok.com/ABC/", async () => new Response(null, { status: 200 })), /전체 주소/);
});
