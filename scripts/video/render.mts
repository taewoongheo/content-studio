import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { readFile } from "node:fs/promises";
import path from "node:path";
const [propsPath, publicDir, output, previewFrames, previewScale] = process.argv.slice(2);
if (!propsPath || !publicDir || !output) throw new Error("렌더링 인수가 필요합니다.");
const props = JSON.parse(await readFile(propsPath, "utf8"));
const serveUrl = await bundle({
  entryPoint: path.resolve("src/domains/video/remotion/entry.tsx"), publicDir,
  webpackOverride: config => ({
    ...config,
    resolve: { ...config.resolve, alias: { ...config.resolve?.alias, "@": path.resolve("src") } },
  }),
});
const composition = await selectComposition({ serveUrl, id: "ContentStudioVideo", inputProps: props });
if (previewFrames) {
  for (const [index, frame] of (JSON.parse(previewFrames) as number[]).entries()) {
    await renderStill({ serveUrl, composition, inputProps: props, frame, imageFormat: "png", scale: Number(previewScale),
      output: path.join(output, `${index}.png`), overwrite: true });
  }
} else await renderMedia({ serveUrl, composition, inputProps: props, codec: "h264", pixelFormat: "yuv420p", outputLocation: output, concurrency: 2, overwrite: true });
