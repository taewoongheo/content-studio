import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { EditorCommand } from "@/lib/content-jobs/editor/types";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
import { defaultProjectStores, loadContentProject, updateContentProjectReuse } from "@/lib/content-jobs/projects/service";
import { getLocalDatabase } from "@/lib/local-db/database";
import { cloneSchema, setCompositionSchema, registerTemplateSchema, editSchema, previewSchema, projectSchema, undoSchema } from "./tools/schema";
import type { LocalImageCommand } from "./tools/images";
import { McpProjectWrites } from "./tools/project-writes";
import { previewSlide } from "./preview/render";

const json = (data: Record<string, unknown>): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data,
});
function guarded(operation: () => Promise<CallToolResult> | CallToolResult): Promise<CallToolResult> {
  return Promise.resolve().then(operation).catch((error) => ({
    isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "작업을 처리하지 못했습니다." }],
  }));
}
const annotations = (readOnlyHint: boolean) => ({ readOnlyHint, destructiveHint: false, openWorldHint: false });

/** A fresh protocol instance per HTTP request; project state belongs to the app registry. */
export function createStudioMcpServer(origin: string) {
  const server = new McpServer({ name: "content-studio", version: "0.1.0" }, {
    instructions: "For new slides, select a template using only list_template_guides metadata. Do not read full project JSON or previews to compare candidates. Creation requires clone_project with a registered templateProjectId; no templates means creation is unavailable. After selection, read the cloned project before editing. Preserve inherited hook/body styles and account badges while replacing content. Template registration references the original project: editing it changes the template. set_reuse_guide updates project metadata; register_template and unregister_template manage designation only when requested by the user. Select by visual information structure and page flow, regardless of the current subject. Registration and cloning require a non-empty composition description. Registration can save composition atomically. Never auto-register to bypass creation restrictions or modify the original to fit a new post. Registration does not save active drafts. Find and select local images with your filesystem tools, then use set_local_image inside edit_project. Edit batches are one undo step. Fonts: anton for hooks (400), space-grotesk for body headings (300-700, recommended 700), inter for body text (100-900, recommended 400-500), sans-serif for the Geist fallback (100-900). Text style fontStyle accepts normal or italic; Inter and Geist load true italics, Anton and Space Grotesk use a synthesized slant. Projects are open tabs. Creation/clone/open adds a tab without switching the browser. Closed tabs reject edits; explicitly open and read again. Edit/undo require expectedTabId and expectedRevision from the latest read. Never write the app database directly.",
  });
  const describe = (id: string) => {
    const job = contentJobRegistry.get(id);
    return { ...job, url: `${origin}/?job=${encodeURIComponent(id)}` };
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
        createdAt: job.createdAt, updatedAt: job.updatedAt, state: job.savedRevision === job.editor.revision ? "saved" : "draft", url: `${origin}/?job=${encodeURIComponent(job.id)}` });
    }
    return json({ projects: [...entries.values()] });
  }));
  server.registerTool("open_project", {
    description: "Load a saved project into app memory for editing. Existing drafts and their undo history are preserved. Returns an editor URL; does not navigate the user's browser.",
    inputSchema: projectSchema, annotations: annotations(false),
  }, ({ projectId }) => guarded(async () => {
    await loadContentProject(contentJobRegistry, projectId);
    return json(describe(projectId));
  }));
  server.registerTool("list_template_guides", {
    description: "Return all registered template projects with reuse guides and summary metadata only. Choose by composition: information grouping, arrangement, repeated page structure and content flow, regardless of topic. Follow the user's specified registered template; otherwise select the closest composition even without an exact format match. Do not read candidate document JSON, assets or previews to choose. Empty list means new project creation is unavailable; ask the user to designate an existing saved project for registration.",
    inputSchema: z.strictObject({}), annotations: annotations(true),
  }, () => guarded(() => json({ templates: defaultProjectStores().projects.listTemplates() })));
  server.registerTool("set_reuse_guide", {
    description: "Save a project's composition description (max 2000 characters): visual information structure and page flow. Describe grouping, placement, repeated page patterns, whether alternatives appear together or each subject is explained separately. Keep it reusable across topics; do not list topic-specific suitability, reader outcomes or required content. For example: introduction followed by one ranked item per page with a short evaluation and image; one subject per page with two explanations and an image; grouped alternatives shown together with a choose-one prompt. Read element roles and the actual document when authoring or maintaining this description, but never to compare template candidates during selection. Update when composition or flow changes. Does not change template designation; use register_template and unregister_template. An empty string clears the description only for unregistered projects.",
    inputSchema: setCompositionSchema, annotations: annotations(false),
  }, ({ projectId, composition }) => guarded(() => {
    const project = updateContentProjectReuse(projectId, { composition });
    return json({ project });
  }));
  server.registerTool("register_template", {
    description: "Register an existing saved project as a template by referencing the original, without copying or creating a project. Editing the original changes future clones; existing clones remain independent. Use only when the user requests template registration, never automatically to bypass clone restrictions or because a new post was created. Requires a non-empty composition description: optionally provide composition (1-2000 characters) to save it and register atomically, or use the already saved guide. Follow set_reuse_guide's composition criteria. Repeated registration is safe. Does not save an active draft; registration refers to the saved project. Returns summary metadata and refreshes dashboard lists.",
    inputSchema: registerTemplateSchema, annotations: annotations(false),
  }, ({ projectId, composition }) => guarded(() => {
    const project = updateContentProjectReuse(projectId, { isTemplate: true, composition });
    return json({ project });
  }));
  server.registerTool("unregister_template", {
    description: "Remove a saved project's template designation when the user requests it. Preserves the original document, assets and composition, as well as existing clones. The project remains in saved projects but can no longer be cloned via clone_project. Repeated unregistration is safe; unknown project IDs are errors. Returns summary metadata and refreshes dashboard lists.",
    inputSchema: projectSchema, annotations: annotations(false),
  }, ({ projectId }) => guarded(() => {
    const project = updateContentProjectReuse(projectId, { isTemplate: false });
    return json({ project });
  }));
  server.registerTool("clone_project", {
    description: "Create and save a new project by cloning a registered template's current document and assets. templateProjectId is required and must come from list_template_guides. Preserves the source. No blank creation or cloning unregistered projects. New projects are not registered as templates.",
    inputSchema: cloneSchema, annotations: annotations(false),
  }, (input) => guarded(() => {
    const job = new McpProjectWrites(contentJobRegistry, getLocalDatabase()).clone(input);
    return json(describe(job.id));
  }));
  server.registerTool("read_project", {
    description: "Read the complete active document JSON, revision and attached images. Open saved projects first. Frame coordinates are normalized to slide size; fontSize is pixels. Element definitions are shared, placements contain per-slide values and overrides.",
    inputSchema: projectSchema, annotations: annotations(true),
  }, ({ projectId }) => guarded(() => json(describe(projectId))));
  server.registerTool("edit_project", {
    description: "Apply an ordered command batch atomically as one undo step and save it to the database before returning success. Use expectedTabId and expectedRevision from read/edit/undo; on conflict re-read. update_visual common changes the shared definition AND clears matching local overrides on all placements; local changes only the specified slide placement. Rectangle/circle/triangle/text/image are elements: add_element then place_element. set_local_image loads a PNG/JPG/WebP absolute localPath (max 10MB) into an existing image placement, including one created earlier in this batch. set_text_colors replaces a text placement’s color ranges (start/end are UTF-16 offsets, end exclusive, grapheme boundaries, sorted and non-overlapping; [] clears colors). set_slot_value optionally accepts textColors for an atomic text/color replacement; otherwise existing ranges adjust to the text edit. Non-background placements render back-to-front; the background sentinel must be last in reorder_layers. No separate image-upload tool is needed.",
    inputSchema: editSchema, annotations: annotations(false),
  }, (raw) => guarded(async () => {
    const { projectId, commands, expectedRevision, expectedTabId } = raw as { projectId: string; commands: Array<EditorCommand | LocalImageCommand>; expectedRevision: number; expectedTabId: string };
    const job = await new McpProjectWrites(contentJobRegistry, getLocalDatabase()).edit(projectId, commands, expectedRevision, expectedTabId);
    return json({ ...job, url: `${origin}/?job=${encodeURIComponent(job.id)}` });
  }));
  server.registerTool("undo_project", {
    description: "Undo the last edit batch, including text, styles and image placement. Imported assets remain available. Saves the restored document before returning success with the new document and revision. Include expectedTabId from the latest read.",
    inputSchema: undoSchema, annotations: annotations(false),
  }, ({ projectId, expectedRevision, expectedTabId }) => guarded(() => json({ ...new McpProjectWrites(contentJobRegistry, getLocalDatabase()).undo(projectId, expectedRevision, expectedTabId) })));
  server.registerTool("preview_slide", {
    description: "See one slide as a PNG rendered by the same renderer as the editor/export. Uses a snapshot and returns its revision. Does not save the project.",
    inputSchema: previewSchema, annotations: annotations(true),
  }, ({ projectId, slideId }) => guarded(async () => {
    const job = contentJobRegistry.get(projectId);
    const data = await previewSlide(origin, job, slideId);
    return { content: [{ type: "image", mimeType: "image/png", data },
      { type: "text", text: JSON.stringify({ projectId, slideId, revision: job.editor.revision }) }] };
  }));
  return server;
}
