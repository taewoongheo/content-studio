import { isExternalProduction, type ProductionInput, type ProductionRequest } from "../../../domain/start/input";
import { REFERENCE_LIMIT } from "../../../domain/references/context";
import type { ProductionStep } from "../../../domain/contracts";

export const PRODUCTION_MODEL = "gpt-6.1-sol";

const referenceTools = [
  "production_reference_images", "production_external_references", "production_describe_reference", "production_read_images",
];
const commonTools = [
  "production_context", "production_query", "production_validate_completion",
  "production_save_draft", "production_read_project", "production_preview_project",
];
export const editorReadTools = ["open_project", "read_project", "preview_slide", "preview_slides", "inspect_slide_layout"];
export const editorWriteTools = [
  "production_clone_project", "production_create_project", "production_use_generated_image", "production_change_direction",
  "edit_project", "undo_project", "rename_project", "set_content_metadata",
];

/** Every node can repair the linked project; resolved origin controls source tools; request mode controls overlap policy. */
export function stagePolicy(step: ProductionStep, input: ProductionInput | ProductionRequest["mode"] = "automatic") {
  const mode = typeof input === "string" ? input : input.request.mode;
  const external = isExternalProduction(input);
  const tools = new Set([...commonTools, ...editorReadTools, ...editorWriteTools,
    "production_repair_badge", "production_read_images"]);
  if (external) {
    tools.delete("production_clone_project");
    tools.delete("production_repair_badge");
  } else tools.delete("production_create_project");
  if (external && mode !== "automatic") for (const tool of referenceTools) tools.add(tool);
  if (mode === "automatic") tools.add("production_comparisons");
  if (mode !== "automatic" || !["analysis", "production"].includes(step)) tools.delete("production_change_direction");
  return { imageGeneration: true, externalCollection: false,
    externalLimit: external && mode !== "automatic" ? REFERENCE_LIMIT : 0, webSearch: true, shell: true, tools };
}
