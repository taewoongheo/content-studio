import { updateContentMetadata } from "@/domains/content-production/server/projects/metadata";
import { requestIdSchema } from "../protocol/requests";
import { OperationError } from "@/lib/errors/operation";
import { registerTool } from "../protocol/tools";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { inspectSlideshow, summarizeSlideshow } from "@/domains/slideshow/projects/inspection/read";
import type { EditorCommand } from "@/domains/slideshow/editor/types";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { defaultProjectStores, loadContentProject } from "@/domains/slideshow/projects/service";
import { getLocalDatabase } from "@/lib/local-db/database";
import { cloneSchema, editSchema, previewSchema, projectSchema, readProjectSchema, undoSchema, setContentMetadataSchema } from "./schema";
import type { LocalImageCommand } from "@/domains/slideshow/server/local-images";
import { SlideshowProjectWrites, type ProjectWriteValidator } from "@/domains/slideshow/server/project-writes";
import { previewSlides } from "@/domains/slideshow/server/rendering/preview";
import { captureSlideshowRender } from "@/domains/slideshow/server/rendering/input";
import { exportSlideshow } from "@/domains/slideshow/server/rendering/export";
import { validateExportPath } from "@/lib/media/export/file";
import { renderJobs } from "@/domains/workspace/server/jobs/manager";
import { renameProject } from "@/domains/slideshow/projects/lifecycle/management";

import { notifyProjectsChanged } from "@/domains/workspace/server/project-events";
import { json, guarded, annotations } from "../protocol/result";

export function registerProjectTools(server: McpServer, origin: string, validateProject?: ProjectWriteValidator) {
  registerTool(server, "create_project", {
    description: "Create and save a slideshow without a template. Read docs/content-metadata.md before saving topic/message/content_type. Metadata must come from user or production planning. Follow docs/content-guidelines.md, reference actual past post images and review all slides. Returns the open editor identity.",
    inputSchema: setContentMetadataSchema.omit({projectId:true}).extend({name:z.string().min(1).max(120),slideCount:z.number().int().min(1).max(20).default(6),requestId:requestIdSchema}), annotations:annotations(false),deduplicate:true,
  }, input => guarded(() => {
    const job=new SlideshowProjectWrites(contentJobRegistry,getLocalDatabase(),validateProject).create(input);
    return json({...job,url:`${origin}/?job=${encodeURIComponent(job.id)}`});
  }));
  const describe = (id: string) => {
    const job = contentJobRegistry.get(id);
    return { ...job, project: defaultProjectStores().projects.getSummary(id), url: `${origin}/?job=${encodeURIComponent(id)}` };
  };
  registerTool(server, "list_projects", {
    description: "Find saved projects and active drafts. Match user-provided names or URL ?job IDs. Active drafts take precedence over saved versions of the same ID; do not guess between ambiguous matches.",
    inputSchema: z.strictObject({}), annotations: annotations(true),
  }, () => guarded(() => {
    const stores = defaultProjectStores();
    const saved = stores.projects.list();
    const entries = new Map(saved.map((project) => [project.id, { ...project, state: "saved", url: `${origin}/?job=${encodeURIComponent(project.id)}` }]));
    for (const job of contentJobRegistry.list()) {
      entries.set(job.id, { id: job.id, name: job.name ?? entries.get(job.id)?.name ?? "새 프로젝트",
        aspectRatio: job.aspectRatio, slideCount: job.slideCount, outputLanguage: job.outputLanguage,
        topic: entries.get(job.id)?.topic ?? "", message: entries.get(job.id)?.message ?? "", content_type: entries.get(job.id)?.content_type ?? "",
        createdAt: job.createdAt, updatedAt: job.updatedAt, state: job.savedRevision === job.editor.revision ? "saved" : "draft", url: `${origin}/?job=${encodeURIComponent(job.id)}` });
    }
    return json({ projects: [...entries.values()] });
  }));
  registerTool(server, "set_content_metadata", {
    description: "Save topic, message and free-text content_type following docs/content-metadata.md. Does not save active slide edits or register a publication.",
    inputSchema: setContentMetadataSchema, annotations: annotations(false),
  }, ({ projectId, topic, message, content_type }) => guarded(() => {
    const project = updateContentMetadata(getLocalDatabase(), projectId, { topic, message, content_type });
    notifyProjectsChanged();
    return json({ project });
  }));
  registerTool(server, "open_project", {
    description: "Load a saved project into app memory for editing. Existing drafts and their undo history are preserved. Returns an editor URL; does not navigate the user's browser.",
    inputSchema: projectSchema, annotations: annotations(false),
  }, ({ projectId }) => guarded(async () => {
    await loadContentProject(contentJobRegistry, projectId);
    return json(describe(projectId));
  }));
  registerTool(server, "clone_project", {
    description: "Duplicate an existing slideshow and its assets into an independent project. Preserve the source; optionally supply topic, message and content_type together. This is manual duplication, not automatic content planning.",
    inputSchema: cloneSchema, annotations: annotations(false), deduplicate: true,
  }, (input) => guarded(() => {
    const job = new SlideshowProjectWrites(contentJobRegistry, getLocalDatabase(), validateProject).clone(input);
    return json(describe(job.id));
  }));
  registerTool(server, "read_project", {
    description: "Read active slideshow state. Default returns the complete document. Use outline=true for content/IDs without styles, slideIds/elementIds for focused reads, includeAssets=false to omit image metadata. Filtered document responses have partial=true and retain the current tabId/revision. Unknown IDs are errors. Open saved projects first. Frame coordinates are normalized to slide size; fontSize is pixels. Element definitions are shared, placements contain per-slide values and overrides.",
    inputSchema: readProjectSchema, annotations: annotations(true),
  }, ({ projectId, ...options }) => guarded(() => json({ ...inspectSlideshow(contentJobRegistry.get(projectId), options),
    project: defaultProjectStores().projects.getSummary(projectId), url: `${origin}/?job=${encodeURIComponent(projectId)}` })));
  registerTool(server, "edit_project", {
    description: "Apply an ordered command batch atomically as one undo step and save it to the database before returning success. includeDocument defaults true for compatibility; set false for a compact revision and resulting ID summary when the edited content is already known. Use expectedTabId and expectedRevision from read/edit/undo; on conflict re-read. update_visual common changes the shared definition AND clears matching local overrides on all placements; local changes only the specified slide placement. style.rotation is clockwise degrees (-360 to 360) around the element center; omission means 0. Set it in add_element or update_visual (common/local); read, undo, save, preview and export preserve it. Rectangle/circle/triangle/text/image are elements: add_element then place_element. set_local_image loads a PNG/JPG/WebP absolute localPath (max 10MB) into an existing image placement, including one created earlier in this batch. set_text_colors replaces a text placement’s color ranges (start/end are UTF-16 offsets, end exclusive, grapheme boundaries, sorted and non-overlapping; [] clears colors). set_text_weights replaces textWeights ranges (start/end UTF-16 offsets with the same boundary rules; fontWeight integer 100–900, resolved to supported font weights; [] clears). Color and weight ranges are independent and may overlap each other. set_slot_value optionally accepts textColors and textWeights for an atomic text/style replacement; omitted existing ranges adjust to the text edit. Non-background placements render back-to-front; the background sentinel must be last in reorder_layers. No separate image-upload tool is needed. Batch related commands in one call. The final document is inspected once after the batch; warnings are advisory. set_slide_role changes hook/body/cta metadata without changing the page appearance. remove_element deletes an unused non-background definition and rejects definitions still used by placements. Use rebind_element to connect an existing placement to a same-kind Element while preserving its content and resolved appearance.",
    inputSchema: editSchema, annotations: annotations(false),
  }, (raw) => guarded(async () => {
    const { projectId, commands, expectedRevision, expectedTabId, includeDocument } = raw as { projectId: string; commands: Array<EditorCommand | LocalImageCommand>; expectedRevision: number; expectedTabId: string; includeDocument?: boolean };
    const job = await new SlideshowProjectWrites(contentJobRegistry, getLocalDatabase(), validateProject).edit(projectId, commands, expectedRevision, expectedTabId);
    return json({ ...(includeDocument === false ? summarizeSlideshow(job) : job), warnings: job.warnings ?? [], url: `${origin}/?job=${encodeURIComponent(job.id)}` });
  }));
  registerTool(server, "undo_project", {
    description: "Undo the last edit batch, including text, styles and image placement. Imported assets remain available. Saves the restored document before returning success with the new document and revision. Include expectedTabId from the latest read.",
    inputSchema: undoSchema, annotations: annotations(false),
  }, ({ projectId, expectedRevision, expectedTabId }) => guarded(() => json({ ...new SlideshowProjectWrites(contentJobRegistry, getLocalDatabase(), validateProject).undo(projectId, expectedRevision, expectedTabId) })));
  registerTool(server, "preview_slide", {
    description: "See one slide as a PNG rendered by the same renderer as the editor/export. Uses a snapshot and returns its revision. Does not save the project.",
    inputSchema: previewSchema, annotations: annotations(true),
  }, ({ projectId, slideId }) => guarded(async () => {
    const input = captureSlideshowRender(contentJobRegistry, projectId, [slideId]);
    const data = (await previewSlides(origin, input.job, [slideId], { images: input.images }))[0].bytes.toString("base64");
    return { content: [{ type: "image", mimeType: "image/png", data },
      { type: "text", text: JSON.stringify({ projectId, slideId, revision: input.job.editor.revision }) }] };
  }));
  registerTool(server, "preview_slides", {
    description: "Review several slides in ONE call with a reused renderer and revision cache. Omit slideIds to review all slides; IDs preserve requested order. Width defaults to 540px (64-1920, capped at original width). Returns PNG images with slide IDs and captured revision. Does not edit, save or navigate the UI.",
    inputSchema: projectSchema.extend({ slideIds: z.array(z.string().min(1)).min(1).max(20).optional(), width: z.number().int().min(64).max(1920).default(540) }), annotations: annotations(true),
  }, ({ projectId, slideIds, width }) => guarded(async () => {
    const input = captureSlideshowRender(contentJobRegistry, projectId, slideIds);
    const results = await previewSlides(origin, input.job, slideIds ?? input.job.editor.document.slides.map(slide => slide.id), { width, images: input.images });
    return { content: [{ type: "text", text: JSON.stringify({ projectId, tabId: input.job.tabId, revision: input.job.editor.revision, slideIds: results.map(result => result.slideId) }) },
      ...results.flatMap(result => [{ type: "text" as const, text: result.slideId }, { type: "image" as const, mimeType: "image/png", data: result.bytes.toString("base64") }])] };
  }));
  registerTool(server, "rename_project", {
    description: "Rename a slideshow project without editing or saving its document. Require latest open tab identity and revision; returns current revision and name. Video names use rename_video_project.",
    inputSchema: undoSchema.extend({ name: z.string().trim().min(1).max(120) }), annotations: annotations(false),
  }, ({ projectId, expectedTabId, expectedRevision, name }) => guarded(() => {
    const current = contentJobRegistry.requireTab(projectId, expectedTabId);
    if (current.editor.revision !== expectedRevision) throw new OperationError("REVISION_CONFLICT", "문서가 변경되었습니다. 최신 revision을 읽어 주세요.",
      { projectId, expectedRevision, actualRevision: current.editor.revision }, "read_latest");
    renameProject(contentJobRegistry, projectId, name, expectedTabId);
    const job = contentJobRegistry.get(projectId);
    return json({ projectId, tabId: job.tabId, revision: job.editor.revision, name: job.name });
  }));
  registerTool(server, "export_slideshow", {
    description: "Export all slideshow slides as numbered full-resolution PNGs in one ZIP to an absolute outputPath. Requires latest tabId/revision. Returns a render job immediately: poll get_render_job for final outputPath/bytes or cancel_render_job. Captures document and image bytes at the requested revision; later edits do not change this export. Existing files require overwrite=true; failures/cancellation preserve existing output.",
    inputSchema: undoSchema.extend({ requestId: requestIdSchema, outputPath: z.string().min(1), overwrite: z.boolean().default(false) }), annotations: annotations(false), deduplicate: true,
  }, ({ projectId, expectedTabId, expectedRevision, outputPath, overwrite }) => guarded(() => {
    const job = contentJobRegistry.requireTab(projectId, expectedTabId);
    if (job.editor.revision !== expectedRevision) throw new OperationError("REVISION_CONFLICT", "문서가 변경되었습니다. 최신 revision을 읽어 주세요.",
      { projectId, expectedRevision, actualRevision: job.editor.revision }, "read_latest");
    validateExportPath(outputPath, "zip");
    const input = captureSlideshowRender(contentJobRegistry, projectId);
    return json(renderJobs.start({ projectId, projectType: "slideshow", revision: expectedRevision }, async context =>
      ({ outputPath, bytes: await exportSlideshow(origin, input, outputPath, overwrite, context) })));
  }));
}
