import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { EditorCommand } from "@/domains/slideshow/editor/types";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { defaultProjectStores, loadContentProject, updateContentProjectReuse } from "@/domains/slideshow/projects/service";
import { getLocalDatabase } from "@/lib/local-db/database";
import { cloneSchema, setCompositionSchema, registerTemplateSchema, editSchema, previewSchema, projectSchema, undoSchema, setContentMetadataSchema } from "./schema";
import type { LocalImageCommand } from "@/domains/slideshow/server/local-images";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import { previewSlides } from "@/domains/slideshow/server/preview";
import { captureSlideshowRender } from "@/domains/slideshow/server/rendering/input";
import { exportSlideshow } from "@/domains/slideshow/server/rendering/export";
import { validateExportPath } from "@/lib/media/export/file";
import { renderJobs } from "@/domains/workspace/server/jobs/manager";
import { renameProject } from "@/domains/slideshow/projects/lifecycle/management";

import { notifyProjectsChanged } from "@/domains/workspace/server/project-events";
import { json, guarded, annotations } from "../protocol/result";

export function registerProjectTools(server: McpServer, origin: string) {
  const describe = (id: string) => {
    const job = contentJobRegistry.get(id);
    return { ...job, project: defaultProjectStores().projects.getSummary(id), url: `${origin}/?job=${encodeURIComponent(id)}` };
  };
  server.registerTool("list_projects", {
    description: "Find saved projects and active drafts. Match user-provided names or URL ?job IDs. Active drafts take precedence over saved versions of the same ID; do not guess between ambiguous matches.",
    inputSchema: z.strictObject({}), annotations: annotations(true),
  }, () => guarded(() => {
    const saved = defaultProjectStores().projects.list();
    const entries = new Map(saved.map((project) => [project.id, { ...project, state: "saved", url: `${origin}/?job=${encodeURIComponent(project.id)}` }]));
    for (const job of contentJobRegistry.list()) {
      entries.set(job.id, { id: job.id, name: job.name ?? entries.get(job.id)?.name ?? "새 프로젝트",
        aspectRatio: job.aspectRatio, slideCount: job.slideCount, outputLanguage: job.outputLanguage,
        composition: entries.get(job.id)?.composition ?? "", isTemplate: entries.get(job.id)?.isTemplate ?? false,
        templateOrder: entries.get(job.id)?.templateOrder ?? null,
        sourceTemplateProjectId: entries.get(job.id)?.sourceTemplateProjectId ?? null, sourceTemplateName: entries.get(job.id)?.sourceTemplateName ?? null,
        registeredTemplateName: entries.get(job.id)?.registeredTemplateName ?? null, sourceTemplateExcluded: entries.get(job.id)?.sourceTemplateExcluded ?? false,
        topic: entries.get(job.id)?.topic ?? "", message: entries.get(job.id)?.message ?? "", publishedAt: entries.get(job.id)?.publishedAt ?? null,
        createdAt: job.createdAt, updatedAt: job.updatedAt, state: job.savedRevision === job.editor.revision ? "saved" : "draft", url: `${origin}/?job=${encodeURIComponent(job.id)}` });
    }
    return json({ projects: [...entries.values()] });
  }));
  server.registerTool("get_content_plan", {
    description: "Read the single template loop in templateOrder and its nextTemplateId, all published projects ordered newest first, and unpublished drafts. Before research, use this plan to choose the next template and a topic/message that avoids repetition across BOTH all published content and that template's history. When constraints conflict, prioritize avoiding repetition in the overall history. Unpublished drafts also help avoid producing duplicate work. Metadata only; no document or previews. Publication is manually recorded by the user in the UI.",
    inputSchema: z.strictObject({}), annotations: annotations(true),
  }, () => guarded(() => json(defaultProjectStores().projects.contentPlan())));
  server.registerTool("set_content_metadata", {
    description: "Save this specific content's topic and concrete message (what the reader should learn or do). These describe the current post, unlike composition which describes a reusable communication purpose and visual structure. Required before publication; update when research changes the message. Optional templateId changes or clears the parent of ordinary content; Registered template content cannot receive a parent. Parent changes affect current history classification, not slides. Does not save active slide edits or mark the project published.",
    inputSchema: setContentMetadataSchema, annotations: annotations(false),
  }, ({ projectId, topic, message, templateId }) => guarded(() => {
    const project = defaultProjectStores().projects.updateMetadata(projectId, { topic, message, templateId });
    notifyProjectsChanged();
    return json({ project });
  }));
  server.registerTool("open_project", {
    description: "Load a saved project into app memory for editing. Existing drafts and their undo history are preserved. Returns an editor URL; does not navigate the user's browser.",
    inputSchema: projectSchema, annotations: annotations(false),
  }, ({ projectId }) => guarded(async () => {
    await loadContentProject(contentJobRegistry, projectId);
    return json(describe(projectId));
  }));
  server.registerTool("list_template_guides", {
    description: "Return all registered template projects with reuse guides and summary metadata only. Use get_content_plan to follow the single loop order before researching a topic. Template topic/message describe a reusable content type and general reader purpose. Composition describes suitable information formats/volume, visual structure and page flow. None summarize the source post’s specific topic or claims. Follow a user-specified template when given. Do not read candidate document JSON, assets or previews to choose. Empty list means new project creation is unavailable; ask the user to designate an existing saved project for registration.",
    inputSchema: z.strictObject({}), annotations: annotations(true),
  }, () => guarded(() => json({ templates: defaultProjectStores().projects.listTemplates() })));
  server.registerTool("set_reuse_guide", {
    description: "Save a project's composition description (max 2000 characters): reusable communication purpose, distinctive visual characteristics and suitable information formats and volume. In 2-4 concise sentences, explain when the template is useful and connect that suitability to its key visual features and relevant page flow. For example: numbered lists for 4-5 or more short text items per page; image cards for grouped alternatives and a choose-one format; a large image and short assessment for one ranked item per page. Describe suitability based on the actual layout, not a guaranteed text capacity or mandatory item count. Avoid exhaustive element placement, coordinates, topic-specific requirements and drafting actual post content. Keep the description reusable across topics. Read element roles and the actual document when authoring or maintaining this description, but never to compare template candidates during selection. Update when visual characteristics, information volume or page flow change the suitable formats. Does not change template designation; use register_template and unregister_template. Requires an existing template setting and a non-empty description.",
    inputSchema: setCompositionSchema, annotations: annotations(false),
  }, ({ projectId, composition }) => guarded(() => {
    const project = updateContentProjectReuse(projectId, { composition });
    return json({ project });
  }));
  server.registerTool("register_template", {
    description: "Register an existing saved project as a template by referencing the original, without copying or creating a project. Editing the original changes future clones; existing clones remain independent. Registration creates independent template settings using the project ID as the source key and forcibly clears its previous parent. Registered content cannot have a parent. templateName/templateTopic/templateMessage are independent of the original project metadata. templateTopic describes a reusable content type and templateMessage a general reader purpose; composition describes its actual visual structure and flow. Do not summarize the original post’s concrete topic, claims or fixed item count. Follow AGENTS.md template information guidance. Use only when the user requests template registration, never automatically to bypass clone restrictions or because a new post was created. Requires a non-empty composition description: optionally provide composition (1-2000 characters) to save it and register atomically, or use the already saved guide. Follow set_reuse_guide's composition criteria. Repeated registration is safe. Does not save an active draft; registration refers to the saved project. Returns summary metadata and refreshes dashboard lists.",
    inputSchema: registerTemplateSchema, annotations: annotations(false),
  }, ({ projectId, composition, templateOrder, templateName, templateTopic, templateMessage }) => guarded(() => {
    const project = updateContentProjectReuse(projectId, { isTemplate: true, composition, templateOrder, templateName, templateTopic, templateMessage });
    return json({ project });
  }));
  server.registerTool("unregister_template", {
    description: "Remove a template from the single loop when requested by deleting its independent settings and clearing all child parent connections atomically. Preserves original and child documents, assets and publication history. The original becomes ordinary saved content. Re-adding requires registering new template settings. The project can no longer be cloned via clone_project. Repeated unregistration is safe; unknown project IDs are errors. Returns summary metadata and refreshes dashboard lists.",
    inputSchema: projectSchema, annotations: { ...annotations(false), destructiveHint: true },
  }, ({ projectId }) => guarded(() => {
    const project = updateContentProjectReuse(projectId, { isTemplate: false });
    return json({ project });
  }));
  server.registerTool("clone_project", {
    description: "Create and save a new project by cloning a template in the single loop. Record its source template automatically. Choose template and topic with get_content_plan before research; pass topic and message together for this specific content. templateProjectId is required and must come from list_template_guides. Preserves the source. No blank creation or cloning unregistered projects. New projects are not registered as templates.",
    inputSchema: cloneSchema, annotations: annotations(false),
  }, (input) => guarded(() => {
    const job = new SlideshowProjectWrites(contentJobRegistry, getLocalDatabase()).clone(input);
    return json(describe(job.id));
  }));
  server.registerTool("read_project", {
    description: "Read the complete active document JSON, revision and attached images. Open saved projects first. Frame coordinates are normalized to slide size; fontSize is pixels. Element definitions are shared, placements contain per-slide values and overrides.",
    inputSchema: projectSchema, annotations: annotations(true),
  }, ({ projectId }) => guarded(() => json(describe(projectId))));
  server.registerTool("edit_project", {
    description: "Apply an ordered command batch atomically as one undo step and save it to the database before returning success. Use expectedTabId and expectedRevision from read/edit/undo; on conflict re-read. update_visual common changes the shared definition AND clears matching local overrides on all placements; local changes only the specified slide placement. style.rotation is clockwise degrees (-360 to 360) around the element center; omission means 0. Set it in add_element or update_visual (common/local); read, undo, save, preview and export preserve it. Rectangle/circle/triangle/text/image are elements: add_element then place_element. set_local_image loads a PNG/JPG/WebP absolute localPath (max 10MB) into an existing image placement, including one created earlier in this batch. set_text_colors replaces a text placement’s color ranges (start/end are UTF-16 offsets, end exclusive, grapheme boundaries, sorted and non-overlapping; [] clears colors). set_text_weights replaces textWeights ranges (start/end UTF-16 offsets with the same boundary rules; fontWeight integer 100–900, resolved to supported font weights; [] clears). Color and weight ranges are independent and may overlap each other. set_slot_value optionally accepts textColors and textWeights for an atomic text/style replacement; omitted existing ranges adjust to the text edit. Non-background placements render back-to-front; the background sentinel must be last in reorder_layers. No separate image-upload tool is needed.",
    inputSchema: editSchema, annotations: annotations(false),
  }, (raw) => guarded(async () => {
    const { projectId, commands, expectedRevision, expectedTabId } = raw as { projectId: string; commands: Array<EditorCommand | LocalImageCommand>; expectedRevision: number; expectedTabId: string };
    const job = await new SlideshowProjectWrites(contentJobRegistry, getLocalDatabase()).edit(projectId, commands, expectedRevision, expectedTabId);
    return json({ ...job, url: `${origin}/?job=${encodeURIComponent(job.id)}` });
  }));
  server.registerTool("undo_project", {
    description: "Undo the last edit batch, including text, styles and image placement. Imported assets remain available. Saves the restored document before returning success with the new document and revision. Include expectedTabId from the latest read.",
    inputSchema: undoSchema, annotations: annotations(false),
  }, ({ projectId, expectedRevision, expectedTabId }) => guarded(() => json({ ...new SlideshowProjectWrites(contentJobRegistry, getLocalDatabase()).undo(projectId, expectedRevision, expectedTabId) })));
  server.registerTool("preview_slide", {
    description: "See one slide as a PNG rendered by the same renderer as the editor/export. Uses a snapshot and returns its revision. Does not save the project.",
    inputSchema: previewSchema, annotations: annotations(true),
  }, ({ projectId, slideId }) => guarded(async () => {
    const input = captureSlideshowRender(contentJobRegistry, projectId);
    const data = (await previewSlides(origin, input.job, [slideId], { images: input.images }))[0].bytes.toString("base64");
    return { content: [{ type: "image", mimeType: "image/png", data },
      { type: "text", text: JSON.stringify({ projectId, slideId, revision: input.job.editor.revision }) }] };
  }));
  server.registerTool("preview_slides", {
    description: "Review several slides in ONE call with a reused renderer and revision cache. Omit slideIds to review all slides; IDs preserve requested order. Width defaults to 540px (64-1920, capped at original width). Returns PNG images with slide IDs and captured revision. Does not edit, save or navigate the UI.",
    inputSchema: projectSchema.extend({ slideIds: z.array(z.string().min(1)).min(1).max(20).optional(), width: z.number().int().min(64).max(1920).default(540) }), annotations: annotations(true),
  }, ({ projectId, slideIds, width }) => guarded(async () => {
    const input = captureSlideshowRender(contentJobRegistry, projectId);
    const results = await previewSlides(origin, input.job, slideIds ?? input.job.editor.document.slides.map(slide => slide.id), { width, images: input.images });
    return { content: [{ type: "text", text: JSON.stringify({ projectId, tabId: input.job.tabId, revision: input.job.editor.revision, slideIds: results.map(result => result.slideId) }) },
      ...results.flatMap(result => [{ type: "text" as const, text: result.slideId }, { type: "image" as const, mimeType: "image/png", data: result.bytes.toString("base64") }])] };
  }));
  server.registerTool("rename_project", {
    description: "Rename a slideshow project without editing or saving its document. Require latest open tab identity and revision; returns current revision and name. Video names use rename_video_project.",
    inputSchema: undoSchema.extend({ name: z.string().trim().min(1).max(120) }), annotations: annotations(false),
  }, ({ projectId, expectedTabId, expectedRevision, name }) => guarded(() => {
    const current = contentJobRegistry.requireTab(projectId, expectedTabId);
    if (current.editor.revision !== expectedRevision) throw new Error("문서가 변경되었습니다. 최신 revision을 읽어 주세요.");
    renameProject(contentJobRegistry, projectId, name, expectedTabId);
    const job = contentJobRegistry.get(projectId);
    return json({ projectId, tabId: job.tabId, revision: job.editor.revision, name: job.name });
  }));
  server.registerTool("export_slideshow", {
    description: "Export all slideshow slides as numbered full-resolution PNGs in one ZIP to an absolute outputPath. Requires latest tabId/revision. Returns a render job immediately: poll get_render_job for final outputPath/bytes or cancel_render_job. Captures document and image bytes at the requested revision; later edits do not change this export. Existing files require overwrite=true; failures/cancellation preserve existing output.",
    inputSchema: undoSchema.extend({ outputPath: z.string().min(1), overwrite: z.boolean().default(false) }), annotations: annotations(false),
  }, ({ projectId, expectedTabId, expectedRevision, outputPath, overwrite }) => guarded(() => {
    const job = contentJobRegistry.requireTab(projectId, expectedTabId);
    if (job.editor.revision !== expectedRevision) throw new Error("문서가 변경되었습니다. 최신 revision을 읽어 주세요.");
    validateExportPath(outputPath, "zip");
    const input = captureSlideshowRender(contentJobRegistry, projectId);
    return json(renderJobs.start({ projectId, projectType: "slideshow", revision: expectedRevision }, async context =>
      ({ outputPath, bytes: await exportSlideshow(origin, input, outputPath, overwrite, context) })));
  }));
}
