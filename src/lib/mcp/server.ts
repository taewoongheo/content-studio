import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { EditorCommand } from "@/lib/content-jobs/editor/types";
import { contentJobRegistry, editorService } from "@/lib/content-jobs/workflow/service";
import { createContentProject, defaultProjectStores, loadContentProject } from "@/lib/content-jobs/projects/service";
import { getLocalDatabase } from "@/lib/local-db/database";
import { createSchema, editSchema, previewSchema, projectSchema, undoSchema } from "./tools/schema";
import { editWithLocalImages, type LocalImageCommand } from "./tools/images";
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
    instructions: "Read the target project before editing. Reuse a project by passing sourceProjectId to create_project; omit it for a blank project. Find and select local images with your filesystem tools, then use set_local_image inside edit_project. Edit batches are one undo step. Never write the app database directly.",
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
        createdAt: job.createdAt, updatedAt: job.updatedAt, state: "draft", url: `${origin}/?job=${encodeURIComponent(job.id)}` });
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
  server.registerTool("create_project", {
    description: "Create a new unsaved project. Optional sourceProjectId clones its current draft or saved document and assets, without modifying the source. With a source, omit blank-document settings. Without a source, defaults are sequential, 4:5, 6 slides, English. Returns a new ID and editor URL.",
    inputSchema: createSchema, annotations: annotations(false),
  }, (input) => guarded(async () => {
    const job = await createContentProject(contentJobRegistry, input);
    return json(describe(job.id));
  }));
  server.registerTool("read_project", {
    description: "Read the complete active document JSON, revision and attached images. Open saved projects first. Frame coordinates are normalized to slide size; fontSize is pixels. Element definitions are shared, placements contain per-slide values and overrides.",
    inputSchema: projectSchema, annotations: annotations(true),
  }, ({ projectId }) => guarded(() => json(describe(projectId))));
  server.registerTool("edit_project", {
    description: "Apply an ordered command batch atomically as one undo step. Use expectedRevision from read/edit/undo; on conflict re-read. update_visual common changes the shared definition AND clears matching local overrides on all placements; local changes only the specified slide placement. Rectangle/circle/triangle/text/image are elements: add_element then place_element. set_local_image loads a PNG/JPG/WebP absolute localPath (max 10MB) into an existing image placement, including one created earlier in this batch. Non-background placements render back-to-front; the background sentinel must be last in reorder_layers. No separate image-upload tool is needed.",
    inputSchema: editSchema, annotations: annotations(false),
  }, (raw) => guarded(async () => {
    const { projectId, commands, expectedRevision } = raw as { projectId: string; commands: Array<EditorCommand | LocalImageCommand>; expectedRevision: number };
    const job = await editWithLocalImages(contentJobRegistry, getLocalDatabase(), projectId, commands, expectedRevision);
    return json({ ...job, url: `${origin}/?job=${encodeURIComponent(job.id)}` });
  }));
  server.registerTool("undo_project", {
    description: "Undo the last edit batch, including text, styles and image placement. Imported assets remain available. Returns the new document and revision.",
    inputSchema: undoSchema, annotations: annotations(false),
  }, ({ projectId, expectedRevision }) => guarded(() => json({ ...editorService.undo(projectId, expectedRevision) })));
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
