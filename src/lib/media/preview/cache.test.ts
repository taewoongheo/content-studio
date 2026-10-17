import assert from "node:assert/strict";
import test from "node:test";
import { PreviewCache } from "./cache";
test("미리보기 캐시는 바이트·항목 한도를 지키고 최근 사용 항목을 유지한다", () => {
  const cache = new PreviewCache(6, 2); cache.set("a", Buffer.from("aaa")); cache.set("b", Buffer.from("bbb"));
  cache.get("a"); cache.set("c", Buffer.from("ccc")); assert.equal(cache.get("b"), undefined);
  cache.set("large", Buffer.alloc(7)); assert.ok(cache.get("a"));
  cache.set("a", Buffer.from("a")); assert.equal(cache.get("a")?.toString(), "a");
  assert.equal(cache.get("different-revision"), undefined);
});
