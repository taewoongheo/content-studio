import { chromium, type Browser, type Page } from "playwright";
import type { ContentJobSnapshot } from "@/domains/slideshow/domain/types";
import { serializePreview } from "@/lib/media/preview-queue";
import { PreviewCache } from "@/lib/media/preview/cache";

import { renderSourceKey } from "@/lib/media/rendering/source";

const cache = new PreviewCache();
let sourceKey = "";
let browser: Browser | undefined, page: Page | undefined, pageOrigin = "";
let idle: ReturnType<typeof setTimeout> | undefined;
async function close() { const current = browser; browser = undefined; page = undefined; pageOrigin = ""; await current?.close(); }

export async function previewSlides(origin: string, job: ContentJobSnapshot, slideIds: string[], options: {
  width?: number; images?: Record<string, string>; signal?: AbortSignal; progress?: (progress: number, phase: string) => void;
} = {}) {
  const ids = [...new Set(slideIds)];
  if (!ids.length || ids.length > 20 || ids.some(id => !job.editor.document.slides.some(slide => slide.id === id)))
    throw new Error("미리보기 대상 슬라이드를 1~20장 지정해 주세요.");
  if (options.width !== undefined && (!Number.isInteger(options.width) || options.width < 64 || options.width > 1920))
    throw new Error("미리보기 너비는 64~1920px입니다.");
  return serializePreview(async () => {
    clearTimeout(idle); options.signal?.throwIfAborted();
    const currentKey = await renderSourceKey(["src/domains/slideshow/rendering", "src/domains/slideshow/editor/typography/fonts.ts", "src/app/mcp-preview/page.tsx", "src/app/layout.tsx"]);
    if (sourceKey !== currentKey) { await close(); sourceKey = currentKey; }
    const abort = () => { void close(); };
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      const results = [];
      for (const [index, slideId] of ids.entries()) {
        options.signal?.throwIfAborted();
        const key = JSON.stringify([sourceKey, origin, job.id, job.tabId, job.editor.revision, slideId, options.width ?? 1080]);
        let bytes = cache.get(key);
        if (!bytes) {
          if (!browser?.isConnected()) {
            browser = await chromium.launch({ headless: true }); page = undefined;
          }
          options.signal?.throwIfAborted();
          if (!page || page.isClosed() || pageOrigin !== origin) {
            await page?.close(); page = await browser.newPage(); page.setDefaultTimeout(30_000);
            await page.goto(`${origin}/mcp-preview`, { waitUntil: "domcontentloaded" }); pageOrigin = origin;
          }
          await page.waitForFunction(() => typeof window.renderStudioPreview === "function");
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            const data = await Promise.race([
              page.evaluate(({ job, slideId, width, images }) => window.renderStudioPreview!(job, slideId, width, images),
                { job, slideId, width: options.width, images: options.images }),
              new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("미리보기 렌더링 시간이 초과되었습니다.")), 30_000); }),
            ]);
            bytes = Buffer.from(data.substring(data.indexOf(",") + 1), "base64");
          } catch (error) { await close(); throw error; }
          finally { clearTimeout(timeout); }
          options.signal?.throwIfAborted(); cache.set(key, bytes);
        }
        results.push({ slideId, bytes }); options.progress?.((index + 1) / ids.length, "rendering slides");
      }
      return results;
    } finally {
      options.signal?.removeEventListener("abort", abort);
      idle = setTimeout(() => { void close(); }, 30_000); idle.unref();
    }
  }, options.signal);
}
