import { requestIdSchema } from "../protocol/requests";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { registerTool } from "../protocol/tools";
import { annotations, guarded, json } from "../protocol/result";
import { templateCreateSchema, requiredCompositionSchema } from "@/domains/slideshow/templates/metadata";
import { createTemplateFromProject, updateTemplateSettings, deleteTemplate } from "@/domains/slideshow/templates/service";
import { defaultProjectStores } from "@/domains/slideshow/projects/service";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";

export function registerTemplateTools(server: McpServer) {
  registerTool(server, "list_template_guides", {
    description: "List independent templates in loop order, with reusable metadata only. Select using metadata; do not inspect candidate documents or previews to compare. Creation uses clone_project with templateId. Follow docs/content-guidelines.md.",
    inputSchema: z.strictObject({}), annotations: annotations(true),
  }, () => guarded(() => json({ templates: defaultProjectStores().projects.listTemplates() })));
  registerTool(server, "register_template", {
    description: "Create an independent template from selected saved project slideIds, copying their content, shared Element relationships and used images. Returns a NEW template ID; stores no connection to the source project. Only when explicitly requested. Requires reusable metadata per AGENTS.md. Does not save active drafts. No fixed number of pages per role is enforced. Related settings can later be edited in the UI. Open the returned template ID with open_project to edit its document using the shared editor.",
    inputSchema: templateCreateSchema.extend({ projectId: z.string().min(1), requestId: requestIdSchema }), annotations: annotations(false), deduplicate: true,
  }, input => guarded(() => json({ template: createTemplateFromProject(defaultProjectStores().projects, input.projectId, templateCreateSchema.strip().parse(input)) })));
  registerTool(server, "set_reuse_guide", {
    description: "Update an independent template's reusable composition description. See AGENTS.md template information guidance. Does not edit a project or save an active document.",
    inputSchema: z.strictObject({ templateId: z.string().min(1), composition: requiredCompositionSchema }), annotations: annotations(false),
  }, ({ templateId, composition }) => guarded(() => json({ template: updateTemplateSettings(contentJobRegistry, defaultProjectStores().projects, templateId, { composition }) })));
  registerTool(server, "unregister_template", {
    description: "Delete an independent template and its assets, clearing project template links atomically. Existing projects and publication timestamps remain. Only when requested. Closes the template's open editor tab.",
    inputSchema: z.strictObject({ templateId: z.string().min(1) }), annotations: { ...annotations(false), destructiveHint: true },
  }, ({ templateId }) => guarded(() => { deleteTemplate(contentJobRegistry, defaultProjectStores().projects, templateId); return json({ templateId, deleted: true }); }));
}
