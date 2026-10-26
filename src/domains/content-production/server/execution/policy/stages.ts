import { REFERENCE_LIMIT } from "../../../domain/references/context";
import type { ProductionStep } from "../../../domain/contracts";

export const PRODUCTION_MODEL = "gpt-6.1-sol";

const referenceTools = [
  "production_external_references", "production_describe_reference", "production_read_images",
];
const commonTools = [
  "production_context", "production_query", "production_comparisons",
  "production_save_draft", "production_read_project", "production_preview_project",
];
export const editorReadTools = ["open_project", "read_project", "preview_slide", "preview_slides"];
export const editorWriteTools = [
  "production_clone_project", "production_use_generated_image", "production_change_direction",
  "edit_project", "undo_project", "rename_project", "set_content_metadata",
];

const toolsByStage: Record<ProductionStep, readonly string[]> = {
  analysis: [...commonTools, ...referenceTools],
  production: [...commonTools, ...referenceTools, ...editorReadTools, ...editorWriteTools],
  hook: [...commonTools, ...referenceTools, ...editorReadTools, "edit_project"],
  polish: [...commonTools, ...editorReadTools, "edit_project"],
  visual: ["production_context", "production_save_draft", ...editorReadTools, "edit_project"],
};

/** Tool availability and native CLI capabilities are separate enforcement boundaries. */
export function stagePolicy(step: ProductionStep) {
  const usesReferences = step === "analysis" || step === "production" || step === "hook";
  const canResearchCopy = step === "production" || step === "hook";
  return {
    imageGeneration: step === "production",
    externalCollection: step === "analysis",
    externalLimit: usesReferences ? REFERENCE_LIMIT : 0,
    webSearch: canResearchCopy,
    shell: canResearchCopy,
    tools: new Set(toolsByStage[step]),
  };
}
