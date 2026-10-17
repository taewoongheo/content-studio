import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { readFile, writeFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Page } from "playwright";
import sharp from "sharp";
import type { VideoSnapshot } from "@/domains/video/domain/model";

export async function verifyVideoMcp({ origin, directory, videoPath, audioPath, imagePath, page, render }: {
  origin: string; directory: string; videoPath: string; audioPath: string; imagePath: string; page: Page; render: boolean;
}) {
  const client = new Client({ name: "video-mcp-smoke", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
  try {
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = CallToolResultSchema.parse(await client.callTool({ name, arguments: args }, undefined, { timeout: 240000 }));
      if (result.isError) throw new Error(`${name}: ${JSON.stringify(result.content)}`);
      return result;
    };
    const rejected = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, `${name} should reject`);
    };
    const names = (await client.listTools()).tools.map(tool => tool.name);
    for (const name of ["list_video_projects", "create_video_project", "open_video_project", "read_video_project", "edit_video_project", "undo_video_project", "redo_video_project", "rename_video_project", "clone_video_project", "preview_video", "export_video", "start_video_export", "close_video_project", "delete_video_project"])
      assert.ok(names.includes(name), name);
    const empty = (await call("create_video_project", { name: "Empty MCP video" })).structuredContent as VideoSnapshot;
    const guard = (s: VideoSnapshot) => ({ projectId: s.id, expectedTabId: s.tabId, expectedRevision: s.revision });
    await call("rename_video_project", { ...guard(empty), name: "Renamed empty video" });
    const lists = (await call("list_video_projects", {})).structuredContent as { saved: { id: string }[]; open: { projectId: string }[] };
    assert.ok(lists.open.some(project => project.projectId === empty.id));
    assert.ok(!lists.saved.some(project => project.id === empty.id));
    await call("close_video_project", guard(empty));
    await rejected("read_video_project", { projectId: empty.id });
    let project = (await call("create_video_project", { name: "MCP VIDEO", settings: { width: 320, height: 240, duration: 1 } })).structuredContent as VideoSnapshot;
    const read = async () => (await call("read_video_project", { projectId: project.id })).structuredContent as VideoSnapshot;
    const text = randomUUID(), shape = randomUUID(), first = randomUUID(), second = randomUUID(), overlay = randomUUID(), audio = randomUUID(), image = randomUUID();
    const edit = async (commands: Record<string, unknown>[], includeDocument = true) => {
      const result = await call("edit_video_project", { ...guard(project), commands, includeDocument });
      if (includeDocument) project = result.structuredContent as VideoSnapshot;
      else { assert.ok(!("document" in result.structuredContent!)); project = await read(); }
      return result;
    };
    await edit([
      { type: "import_media", localPath: videoPath, layerId: first },
      { type: "import_media", localPath: videoPath, layerId: second },
      { type: "import_media", localPath: videoPath, layerId: overlay, mode: "overlay", from: 5 },
      { type: "import_media", localPath: audioPath, layerId: audio },
      { type: "import_media", localPath: imagePath, layerId: image },
      { type: "add_layer", layer: { kind: "text", id: text, name: "MCP text", text: "MCP TEXT", x: 10, y: 10, width: 220, height: 80, fontSize: 30, fontWeight: 700, color: "#FFFFFF", italic: true, backgroundOpacity: 0.3, paddingX: 4, paddingY: 4, lineHeight: 1.2, fadeIn: 5 } },
      { type: "add_layer", layer: { kind: "shape", id: shape, name: "MCP shape", x: 250, y: 170, width: 60, height: 60, color: "#FF00FF", strokeWidth: 0 } },
    ], false);
    const focused = (await call("read_video_project", { projectId: project.id, layerIds: [text], includeAssets: false })).structuredContent as VideoSnapshot & { partial: boolean };
    assert.equal(focused.partial, true); assert.equal(focused.document.layers.length, 1); assert.equal(focused.document.layers[0].id, text);
    assert.equal("assets" in focused, false);
    const outline = (await call("read_video_project", { projectId: project.id, outline: true })).structuredContent as { layers: unknown[] };
    assert.equal(outline.layers.length, 7);
    assert.equal(project.document.layers.length, 7);
    assert.equal(project.assets.length, 3, "same file is stored once per batch");
    assert.deepEqual(project.document.layers.slice(0, 2).map(layer => layer.from), [0, 30]);
    const before = structuredClone(project);
    await rejected("edit_video_project", { ...guard(project), commands: [
      { type: "import_media", localPath: imagePath }, { type: "remove_layer", layerId: randomUUID() },
    ] });
    assert.deepEqual(await read(), before, "failed batch preserves assets and history");
    await rejected("edit_video_project", { ...guard(project), expectedRevision: project.revision - 1, commands: [{ type: "remove_layer", layerId: shape }] });
    await rejected("edit_video_project", { ...guard(project), commands: [{ type: "update_layer", layerId: shape, changes: { text: "wrong kind" } }] });
    const malformed = join(directory, "invalid.mp4"); await writeFile(malformed, "not a video");
    await rejected("edit_video_project", { ...guard(project), commands: [{ type: "import_media", localPath: malformed }] });
    assert.deepEqual(await read(), before);
    await edit([
      { type: "set_document", changes: { fps: 60, backgroundColor: "#223344" } },
      { type: "update_layer", layerId: first, changes: { trimStart: 6, trimEnd: 54, duration: 48, volume: 0.5, fit: "cover", cropX: 20, cropY: 80 } },
      { type: "replace_media", layerId: image, localPath: imagePath },
      { type: "trim_layer", layerId: audio, edge: "end", deltaFrames: -12 },
    ]);
    assert.equal(project.document.fps, 60);
    assert.equal(project.document.layers.find(layer => layer.id === second)?.from, 48);
    assert.equal(project.document.layers.find(layer => layer.id === audio)?.duration, 108);
    const split = randomUUID();
    await edit([{ type: "split_layer", layerId: first, frame: 24, secondLayerId: split }]);
    await edit([{ type: "reorder_sequence", layerIds: [second, split, first] }, { type: "move_layer", layerId: first, deltaFrames: -500 }]);
    const copiedShape = randomUUID();
    await edit([{ type: "duplicate_layer", layerId: shape, newLayerId: copiedShape }, { type: "remove_layer", layerId: copiedShape }]);
    await edit([{ type: "reorder_layers", layerIds: [...project.document.layers.map(layer => layer.id).filter(id => id !== shape), shape] }]);
    const reordered = structuredClone(project.document);
    project = (await call("undo_video_project", guard(project))).structuredContent as VideoSnapshot;
    project = (await call("redo_video_project", guard(project))).structuredContent as VideoSnapshot;
    assert.deepEqual(project.document, reordered);
    await rejected("preview_video", { projectId: project.id, frames: [108000] });
    const previewStart = performance.now();
    const previews = await call("preview_video", { projectId: project.id, frames: [0, 60], width: 320 });
    const firstPreviewMs = performance.now() - previewStart;
    const cachedStart = performance.now();
    const cached = await call("preview_video", { projectId: project.id, frames: [0, 60], width: 320 });
    assert.deepEqual(cached.content, previews.content);
    console.log("VIDEO PREVIEW CACHE", JSON.stringify({ firstMs: firstPreviewMs, cachedMs: performance.now() - cachedStart }));
    const images = previews.content.filter(block => block.type === "image"); assert.equal(images.length, 2);
    for (const image of images) {
      if (image.type !== "image") continue;
      const bytes = Buffer.from(image.data, "base64");
      const metadata = await sharp(bytes).metadata(); assert.equal(metadata.width, 320); assert.equal(metadata.height, 240);
      const pixel = await sharp(bytes).extract({ left: 280, top: 200, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
      assert.ok(pixel[0] > 240 && pixel[1] < 20 && pixel[2] > 240, "preview uses shape styling and layer order");
      await writeFile(join(directory, `mcp-preview-${image === images[0] ? 0 : 60}.png`), bytes);
    }
    assert.equal((await read()).revision, project.revision, "preview does not edit/save");
    // UI follows MCP edits; local unsaved input remains protected by revision guards.
    await page.goto(`${origin}/?job=${project.id}&type=video`);
    await page.locator(`[data-video-layer="${text}"]`).click();
    await edit([{ type: "update_layer", layerId: text, changes: { text: "MCP LIVE UPDATE" } }]);
    await page.waitForFunction(() => (document.querySelector("textarea") as HTMLTextAreaElement)?.value === "MCP LIVE UPDATE");
    await page.getByLabel("텍스트", { exact: true }).fill("LOCAL UNSAVED");
    await edit([{ type: "update_layer", layerId: text, changes: { text: "REMOTE SAVED" } }]);
    assert.equal(await page.getByLabel("텍스트", { exact: true }).inputValue(), "LOCAL UNSAVED");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "다른 창" }).waitFor();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "최신 내용 불러오기", exact: true }).click();
    await page.waitForFunction(() => (document.querySelector("textarea") as HTMLTextAreaElement)?.value === "REMOTE SAVED");
    await page.goto(origin);
    const clone = (await call("clone_video_project", { ...guard(project), name: "MCP VIDEO COPY" })).structuredContent as VideoSnapshot;
    assert.deepEqual(clone.document, project.document); assert.equal(clone.assets.length, project.assets.length);
    await call("delete_video_project", { ...guard(clone), confirm: true });
    assert.equal((await read()).assets.length, project.assets.length);
    if (render) {
      const outputPath = join(directory, "mcp-output.mp4");
      await call("export_video", { ...guard(project), outputPath });
      const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height", "-of", "json", outputPath], { encoding: "utf8" }));
      assert.ok(probe.streams.some((stream: { codec_name: string; width: number }) => stream.codec_name === "h264" && stream.width === 320));
      assert.ok(probe.streams.some((stream: { codec_name: string }) => stream.codec_name === "aac"));
      const size = (await stat(outputPath)).size;
      await rejected("export_video", { ...guard(project), outputPath });
      assert.equal((await readFile(outputPath)).length, size);
      const waitJob = async (jobId: string) => {
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          const job = (await call("get_render_job", { jobId })).structuredContent as { status: string; progress: number; result?: { bytes: number }; error?: string };
          if (["completed", "failed", "cancelled"].includes(job.status)) return job;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error("render job did not finish");
      };
      const asyncPath = join(directory, "async-video.mp4");
      const captured = (await call("clone_video_project", { ...guard(project), name: "SNAPSHOT EXPORT" })).structuredContent as VideoSnapshot;
      const job = (await call("start_video_export", { ...guard(captured), outputPath: asyncPath })).structuredContent as { jobId: string };
      await call("delete_video_project", { ...guard(captured), confirm: true });
      const finished = await waitJob(job.jobId); assert.equal(finished.status, "completed", finished.error); assert.equal(finished.progress, 1);
      assert.equal((await stat(asyncPath)).size, finished.result?.bytes);
      const asyncProbe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name", "-of", "json", asyncPath], { encoding: "utf8" }));
      assert.ok(asyncProbe.streams.some((stream: { codec_name: string }) => stream.codec_name === "h264"));
      assert.ok(asyncProbe.streams.some((stream: { codec_name: string }) => stream.codec_name === "aac"));
      const cancelPath = join(directory, "cancel-video.mp4"); await writeFile(cancelPath, "keep original");
      const cancelled = (await call("start_video_export", { ...guard(project), outputPath: cancelPath, overwrite: true })).structuredContent as { jobId: string };
      await call("cancel_render_job", { jobId: cancelled.jobId });
      assert.equal((await waitJob(cancelled.jobId)).status, "cancelled");
      assert.equal(await readFile(cancelPath, "utf8"), "keep original");
      console.log("ASYNC VIDEO EXPORT verified: job polling, H.264/AAC, cancellation and existing-file preservation");
    }
    await call("close_video_project", guard(project));
    await rejected("read_video_project", { projectId: project.id });
    const oldTab = project.tabId;
    project = (await call("open_video_project", { projectId: project.id })).structuredContent as VideoSnapshot;
    assert.notEqual(project.tabId, oldTab);
    await rejected("edit_video_project", { ...guard(project), expectedTabId: oldTab, commands: [{ type: "remove_layer", layerId: shape }] });
    await call("delete_video_project", { ...guard(project), confirm: true });
    console.log("video MCP verified: all tools, styles, atomic imports, real metadata, trim/split/order, undo/redo, preview PNGs, live UI/conflict protection, clone/delete/close/reopen, MP4 export");
  } finally { await client.close(); }
}
