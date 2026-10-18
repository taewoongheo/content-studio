import { bundle } from "@remotion/bundler";
import { makeCancelSignal, openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const [propsPath, bundleDirectory, output, previewFrames, previewScale] = process.argv.slice(2);
if (!propsPath || !bundleDirectory || !output) throw new Error("렌더링 인수가 필요합니다.");
const { cancel, cancelSignal } = makeCancelSignal();
let cancelled = false;
process.on("SIGTERM", () => { cancelled = true; cancel(); });
const props = JSON.parse(await readFile(propsPath, "utf8"));
const progress = (value: number, phase: string) => process.send?.({ progress: value, phase });
const marker = path.join(bundleDirectory, ".studio-ready");
const ready = await access(marker).then(() => true, () => false);
if (!ready) {
  progress(0.02, "bundling");
  await bundle({
    entryPoint: path.resolve("src/domains/video/remotion/entry.tsx"), publicDir: null, outDir: bundleDirectory,
    webpackOverride: config => ({ ...config, resolve: { ...config.resolve, alias: { ...config.resolve?.alias, "@": path.resolve("src") } } }),
  });
  await writeFile(marker, "ready");
}
if (cancelled) throw new Error("렌더링을 취소했습니다.");
progress(0.1, "loading composition");
const browser = await openBrowser("chrome");
try {
  const composition = await selectComposition({ serveUrl: bundleDirectory, id: "ContentStudioVideo", inputProps: props, puppeteerInstance: browser });
  if (previewFrames) {
    const frames = JSON.parse(previewFrames) as number[];
    for (const [index, frame] of frames.entries()) {
      await renderStill({ serveUrl: bundleDirectory, composition, inputProps: props, frame, imageFormat: "png", scale: Number(previewScale),
        output: path.join(output, `${index}.png`), overwrite: true, cancelSignal, puppeteerInstance: browser });
      progress(0.1 + 0.85 * (index + 1) / frames.length, "rendering frames");
    }
  } else await renderMedia({ serveUrl: bundleDirectory, composition, inputProps: props, codec: "h264", pixelFormat: "yuv420p", outputLocation: output,
    concurrency: 2, overwrite: true, cancelSignal, puppeteerInstance: browser, onProgress: ({ progress: value }) => progress(0.1 + value * 0.85, "rendering MP4") });
} finally { await browser.close({ silent: true }); }
