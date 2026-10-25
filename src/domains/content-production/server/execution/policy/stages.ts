import { REFERENCE_LIMIT } from "../../../domain/references/context";
import type { ProductionStep } from "../../../domain/contracts";

const commonTools = [
  "production_context", "production_query", "production_external_references",
  "production_describe_reference", "production_comparisons", "production_read_images",
  "production_save_draft", "production_read_project", "production_preview_project",
];
export const editorReadTools = ["open_project", "read_project", "preview_slide", "preview_slides"];
export const editorWriteTools = [
  "production_create_project", "production_import_image", "production_change_direction",
  "edit_project", "undo_project", "rename_project", "set_content_metadata",
];
/** Tool availability and native CLI capabilities are separate enforcement boundaries. */
export function stagePolicy(step: ProductionStep) {
  const external = step === "analysis" || step === "production" || step === "hook";
  return {
    externalCollection: step === "analysis",
    externalLimit: external ? REFERENCE_LIMIT : 0,
    webSearch: step === "production" || step === "hook",
    shell: step === "production" || step === "hook",
    tools: new Set([
      ...commonTools.filter(name => external || !["production_external_references", "production_describe_reference", "production_read_images"].includes(name)),
      ...(step === "visual" ? ["production_visual_references"] : []),
      ...(step === "production" ? [...editorReadTools, ...editorWriteTools]
        : step === "hook" || step === "visual" || step === "polish" ? [...editorReadTools, "edit_project"] : []),
    ]),
  };
}
