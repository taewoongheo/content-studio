import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { refreshMetrics, recentKoreanDate } from "./service";
import { ProductionStore } from "../persistence/store";
import { ApifyTikTokClient } from "@/domains/research/server/apify/client";
import { saveVisuals } from "./visuals";
test("한국 날짜 수집 범위와 실패 시 기존 성과 보존", async () => {
  assert.equal(
    recentKoreanDate("2026-10-18T15:00:00Z", new Date("2026-10-22T02:00:00Z")),
    true,
  );
  assert.equal(
    recentKoreanDate("2026-10-18T14:59:00Z", new Date("2026-10-22T02:00:00Z")),
    false,
  );
  const db = openLocalDatabase(":memory:"),
    store = new ProductionStore(db);
  try {
    const [id] = store.create(1),
      log = store.get(id).task.log_id;
    db.prepare(
      "UPDATE content_creation_logs SET actual_published_at=?,post_url=?,view_count=42 WHERE id=?",
    ).run(new Date().toISOString(), "https://www.tiktok.com/@a/photo/123", log);
    const broken = new ApifyTikTokClient(
      "key",
      async () => new Response(null, { status: 503 }),
    );
    await assert.rejects(() => refreshMetrics(db, undefined, broken));
    assert.equal(store.get(id).log.view_count, 42);
    const valid = new ApifyTikTokClient("key", async () =>
      Response.json([{ id: "123", playCount: 80 }]),
    );
    await refreshMetrics(db, undefined, valid);
    assert.equal(store.get(id).log.view_count, 80);
    assert.equal(store.get(id).log.like_count, null);
  } finally {
    db.close();
  }
});
test("시각 자료 묶음과 모든 장은 함께 저장되고 재시도는 중복 생성하지 않는다", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const input = {
      kind: "reference" as const,
      url: "https://www.tiktok.com/@a/photo/123",
      slides: [{ data: Buffer.from("image"), width: 540, height: 675 }],
    };
    const id = saveVisuals(db, input);
    assert.equal(saveVisuals(db, input), id);
    assert.equal(
      (
        db.prepare("SELECT COUNT(*) n FROM content_visual_slides").get() as {
          n: number;
        }
      ).n,
      1,
    );
    assert.throws(() =>
      saveVisuals(db, {
        ...input,
        url: "https://www.tiktok.com/@a/photo/456",
        slides: [],
      }),
    );
  } finally {
    db.close();
  }
});
