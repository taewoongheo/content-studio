import { requestIdSchema } from "../protocol/requests";
import { registerTool } from "../protocol/tools";
import { inspectVideo } from "@/domains/video/editing/inspection";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { newVideoDocument, videoDocumentSchema, videoDuration, type VideoSnapshot } from "@/domains/video/domain/model";
import { createVideo, openVideo, readVideo, videoTabs, videoStore, writeVideo, historyVideo, renameVideo, cloneVideo, closeVideo, deleteVideoGuarded, checkVideoRevision } from "@/domains/video/server/service";
import { changeVideoFps } from "@/domains/video/domain/settings";
import { renderVideo, renderVideoFrames, captureVideoAssets } from "@/domains/video/server/rendering/render";
import { writeVideoExport } from "@/domains/video/server/rendering/export-file";
import { guarded, json, annotations } from "../protocol/result";
import { renderJobs } from "@/domains/workspace/server/jobs/manager";
import { validateExportPath } from "@/lib/media/export/file";
import { editVideoProject } from "@/domains/video/server/writes";
import { settingsSchema } from "@/domains/video/editing/schema";
import { videoReadSchema, videoEditSchema, videoPreviewSchema, videoProjectSchema, videoRevisionSchema } from "./schema";

export function registerVideoTools(server: McpServer, origin: string) {
  const describe = (snapshot: VideoSnapshot) => ({ ...snapshot, url: `${origin}/?job=${encodeURIComponent(snapshot.id)}` });
  const summary = (snapshot: VideoSnapshot) => ({ projectId: snapshot.id, tabId: snapshot.tabId, name: snapshot.name, revision: snapshot.revision,
    duration: videoDuration(snapshot.document), fps: snapshot.document.fps, canUndo: snapshot.canUndo, canRedo: snapshot.canRedo,
    layers: snapshot.document.layers.map(layer => ({ id: layer.id, kind: layer.kind, name: layer.name, from: layer.from, duration: layer.duration })), assets: snapshot.assets,
    url: `${origin}/?job=${encodeURIComponent(snapshot.id)}` });
  registerTool(server, "list_video_projects", {
    description: "List saved video projects and open drafts; includes small summaries, never full documents or media bytes. Slideshow projects are listed separately by list_projects.",
    inputSchema: z.strictObject({}), annotations: annotations(true),
  }, () => guarded(() => json({ saved: videoStore().list(), open: videoTabs().map(tab => summary(readVideo(tab.projectId))) })));
  registerTool(server, "create_video_project", {
    description: "Create an independent video editor tab without switching the browser. Default 1080x1920, 30fps, white, 5 seconds. Optional settings are document pixels and frames. Unlike slideshow template cloning, blank video creation is supported. Empty drafts are not persisted until first edit. Read the returned tabId/revision for editing.",
    inputSchema: z.strictObject({ requestId: requestIdSchema, name: z.string().trim().min(1).max(120).optional(), settings: settingsSchema.optional() }), annotations: annotations(false), deduplicate: true,
  }, ({ name, settings }) => guarded(() => {
    // Validate before creating an observable tab.
    const defaults = settings?.fps ? changeVideoFps(newVideoDocument(), settings.fps) : newVideoDocument();
    const document = videoDocumentSchema.parse({ ...defaults, ...settings });
    const snapshot = createVideo();
    if (name) renameVideo(snapshot.id, name, snapshot.tabId);
    if (settings && Object.keys(settings).length) return json(describe(writeVideo(snapshot.id, snapshot.tabId, snapshot.revision, document)));
    return json(describe(readVideo(snapshot.id)));
  }));
  registerTool(server, "open_video_project", {
    description: "Open a saved video as an editor tab; reuse an existing tab without switching the browser. Return document, assets, current tabId and revision. Opening does not save or edit.",
    inputSchema: videoProjectSchema, annotations: annotations(false),
  }, ({ projectId }) => guarded(() => json(describe(openVideo(projectId)))));
  registerTool(server, "read_video_project", {
    description: "Read an already open video without saving/opening it. Default returns the full document; use layerIds for selected layers (partial=true), outline=true for IDs/content/timing without styles, includeAssets=false to omit media metadata. All views return tabId/revision; unknown IDs are rejected. All spatial coordinates and sizes are pixels; all timing values are integer frames at document fps. Array layer order is back-to-front; sequenceIndex independently determines connected-clip playback order. Asset bytes are project-local and never included in this response.",
    inputSchema: videoReadSchema, annotations: annotations(true),
  }, ({ projectId, ...options }) => guarded(() => json({ ...inspectVideo(readVideo(projectId), options), url: `${origin}/?job=${encodeURIComponent(projectId)}` })));
  registerTool(server, "edit_video_project", {
    description: "Apply ordered video commands atomically, save before success, and create one undo step. Require latest expectedTabId/revision. Any failed command rolls back document, revision, history and newly imported bytes. set_document changes resolution/background/minimum duration and rescales real-time timing when fps changes. add_layer: text/shape need only kind; all properties can be supplied, IDs optional. update_layer exposes EVERY kind-specific property (text/font/weight/italic/alignment/lineHeight/padding/colors/background/radius/fade; shapes/fill/stroke; position/size/rotation/opacity; assetId/fit/crop; start/duration/source trim/volume/loop/sequence flags/order/anchor). Wrong-kind properties are rejected. To replace a source file use replace_media. import_media reads an absolute local video/audio/image path <=200MB, probes actual metadata, copies bytes; default sequence videos append after ALL layers, overlay videos/images/audio start at frame 0 unless from is supplied. Specify layerId to refer to imports later in the same batch. Use move_layer/trim_layer for UI-equivalent timeline gestures; deltaFrames is relative. split_layer splits non-looping videos. reorder_layers requires ALL layer IDs back-to-front; reorder_sequence requires ALL connected-video IDs in playback order. Selection, guides and ratio-lock are editor view state, not content. Default response is a compact resulting layer summary; includeDocument=true returns full document.",
    inputSchema: videoEditSchema, annotations: annotations(false),
  }, ({ projectId, expectedTabId, expectedRevision, commands, includeDocument }) => guarded(async () => {
    const snapshot = await editVideoProject(projectId, expectedTabId, expectedRevision, commands);
    return json(includeDocument ? describe(snapshot) : summary(snapshot));
  }));
  for (const redo of [false, true]) registerTool(server, redo ? "redo_video_project" : "undo_video_project", {
    description: `${redo ? "Redo" : "Undo"} one video edit batch and save the restored document. Require latest tabId/revision. Existing imported media is retained for history.`,
    inputSchema: videoRevisionSchema, annotations: annotations(false),
  }, ({ projectId, expectedTabId, expectedRevision }) => guarded(() => json(describe(historyVideo(projectId, expectedTabId, expectedRevision, redo)))));
  registerTool(server, "rename_video_project", {
    description: "Rename a video without changing the document or undo history. Require current open tabId/revision. Renaming an empty draft does not create a saved project.",
    inputSchema: videoRevisionSchema.extend({ name: z.string().trim().min(1).max(120) }), annotations: annotations(false),
  }, ({ projectId, expectedTabId, expectedRevision, name }) => guarded(() => {
    checkVideoRevision(projectId, expectedTabId, expectedRevision); renameVideo(projectId, name, expectedTabId); return json(summary(readVideo(projectId)));
  }));
  registerTool(server, "clone_video_project", {
    description: "Clone a saved video document and all its media into an independent project/tab, preserving the source. Current revision guard prevents cloning an older saved state. Empty unsaved drafts cannot be cloned.",
    inputSchema: videoRevisionSchema.extend({ requestId: requestIdSchema, name: z.string().trim().min(1).max(120).optional() }), annotations: annotations(false), deduplicate: true,
  }, ({ projectId, expectedTabId, expectedRevision, name }) => guarded(() => {
    checkVideoRevision(projectId, expectedTabId, expectedRevision);
    const copy = cloneVideo(projectId); if (name) renameVideo(copy.id, name, copy.tabId); return json(describe(readVideo(copy.id)));
  }));
  registerTool(server, "preview_video", {
    description: "See 1-8 exact video frames as PNG images using the SAME Remotion composition as the editor and MP4 export, including video frames, images, text, shapes, crops and transparency. Audio is not audible in a still. Does not save, open, seek or modify the editor. frames are zero-based and must be within the actual video duration; returns the rendered revision and each frame number. Width defaults to 540px, at most 1920; aspect ratio preserved. Review multiple moments before exporting.",
    inputSchema: videoPreviewSchema, annotations: annotations(true),
  }, ({ projectId, frames, width }) => guarded(async () => {
    const snapshot = readVideo(projectId);
    const pngs = await renderVideoFrames(snapshot, frames, width);
    return { content: [{ type: "text", text: JSON.stringify({ projectId, tabId: snapshot.tabId, revision: snapshot.revision, frames, fps: snapshot.document.fps }) },
      ...pngs.map(bytes => ({ type: "image" as const, mimeType: "image/png", data: bytes.toString("base64") }))] };
  }));
  registerTool(server, "start_video_export", {
    description: "Preferred MP4 export for agents: capture current tabId/revision and media, start rendering, return a job immediately. Poll get_render_job for progress/result/error; cancel_render_job cancels safely. Later edits/closing/deleting the source do not change captured media. outputPath is absolute MP4 in an existing directory; overwrite defaults false. No long MCP call or media bytes in the response.",
    inputSchema: videoRevisionSchema.extend({ requestId: requestIdSchema, outputPath: z.string().min(1), overwrite: z.boolean().default(false) }), annotations: annotations(false), deduplicate: true,
  }, ({ projectId, expectedTabId, expectedRevision, outputPath, overwrite }) => guarded(() => {
    checkVideoRevision(projectId, expectedTabId, expectedRevision); validateExportPath(outputPath, "mp4");
    const snapshot = readVideo(projectId), assets = captureVideoAssets(snapshot);
    return json(renderJobs.start({ projectId, projectType: "video", revision: snapshot.revision }, async context => ({ outputPath,
      bytes: await writeVideoExport(outputPath, overwrite, () => renderVideo(snapshot, { ...context, assets }), context.signal) })));
  }));
  registerTool(server, "export_video", {
    description: "Synchronous compatibility export; agents should prefer start_video_export plus get_render_job for long renders. Render the current saved revision to a local H.264/AAC MP4 with the shared Remotion renderer. Require current tabId/revision and an absolute outputPath in an existing directory. Returns a local file path and byte count, not media bytes. Existing files are refused unless overwrite=true. Export can take several minutes; it does not change the project. Preview frames first.",
    inputSchema: videoRevisionSchema.extend({ requestId: requestIdSchema, outputPath: z.string().min(1), overwrite: z.boolean().default(false) }), annotations: annotations(false), deduplicate: true,
  }, ({ projectId, expectedTabId, expectedRevision, outputPath, overwrite }) => guarded(async () => {
    checkVideoRevision(projectId, expectedTabId, expectedRevision);
    const snapshot = readVideo(projectId);
    const bytes = await writeVideoExport(outputPath, overwrite, () => {
      checkVideoRevision(projectId, expectedTabId, expectedRevision);
      return renderVideo(snapshot);
    });
    return json({ projectId, revision: snapshot.revision, outputPath, bytes });
  }));
  registerTool(server, "close_video_project", {
    description: "Close the current saved video tab (or discard an empty draft) when explicitly requested. The saved project and assets remain available to reopen. Subsequent calls using the old tabId are rejected.",
    inputSchema: videoRevisionSchema, annotations: annotations(false),
  }, ({ projectId, expectedTabId, expectedRevision }) => guarded(() => { closeVideo(projectId, expectedTabId, expectedRevision); return json({ projectId, closed: true }); }));
  registerTool(server, "delete_video_project", {
    description: "Permanently delete a video project, its media and open tab ONLY when the user explicitly asks to delete it. Require current tabId/revision and confirm=true. This cannot be undone.",
    inputSchema: videoRevisionSchema.extend({ confirm: z.literal(true) }), annotations: { ...annotations(false), destructiveHint: true },
  }, ({ projectId, expectedTabId, expectedRevision }) => guarded(() => { deleteVideoGuarded(projectId, expectedTabId, expectedRevision); return json({ projectId, deleted: true }); }));
}
