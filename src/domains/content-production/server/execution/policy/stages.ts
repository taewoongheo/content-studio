import { REFERENCE_LIMIT } from "../../../domain/references/context";
import type { ProductionStep } from "../../../domain/contracts";

export const PRODUCTION_MODEL = "gpt-6.1-sol";

const commonTools = [
  "production_context", "production_query", "production_external_references",
  "production_describe_reference", "production_comparisons", "production_read_images",
  "production_save_draft", "production_read_project", "production_preview_project",
];
export const editorReadTools = ["open_project", "read_project", "preview_slide", "preview_slides"];
export const editorWriteTools = [
  "production_clone_project", "production_use_generated_image", "production_change_direction",
  "edit_project", "undo_project", "rename_project", "set_content_metadata",
];
/** Tool availability and native CLI capabilities are separate enforcement boundaries. */
export function stagePolicy(step: ProductionStep) {
  const external = step === "analysis" || step === "production" || step === "hook";
  return {
    imageGeneration: step === "production",
    externalCollection: step === "analysis",
    externalLimit: external ? REFERENCE_LIMIT : 0,
    webSearch: step === "production" || step === "hook",
    shell: step === "production" || step === "hook",
    tools: new Set(step === "visual" ? ["production_context","production_save_draft",...editorReadTools,"edit_project"] : [
      ...commonTools.filter(name => external || !["production_external_references", "production_describe_reference", "production_read_images"].includes(name)),
      ...(step === "production" ? [...editorReadTools, ...editorWriteTools]
        : step === "hook" || step === "polish" ? [...editorReadTools, "edit_project"] : []),
    ]),
  };
}
