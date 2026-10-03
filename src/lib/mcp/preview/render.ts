import { chromium } from "playwright";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import { serializePreview } from "./queue";

export async function previewSlide(origin: string, job: ContentJobSnapshot, slideId: string) {
  if (!job.editor.document.slides.some((slide) => slide.id === slideId)) throw new Error("슬라이드를 찾을 수 없습니다.");
  return serializePreview(async () => {
    const browser = await chromium.launch({ headless: true });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(30_000);
      await page.goto(`${origin}/mcp-preview`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => typeof window.renderStudioPreview === "function");
      const data = await Promise.race([
        page.evaluate(({ job, slideId }) => window.renderStudioPreview!(job, slideId), { job, slideId }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("미리보기 렌더링 시간이 초과되었습니다.")), 30_000);
          timeout.unref();
        }),
      ]);
      return data.substring(data.indexOf(",") + 1);
    } finally { clearTimeout(timeout); await browser.close(); }
  });
}
