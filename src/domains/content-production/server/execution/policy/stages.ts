import type { ProductionRequest } from "../../../domain/start/input";
import { REFERENCE_LIMIT } from "../../../domain/references/context";
import type { ProductionStep } from "../../../domain/contracts";

export const PRODUCTION_MODEL = "gpt-6.1-sol";

const referenceTools = [
  "production_reference_images", "production_external_references", "production_describe_reference", "production_read_images",
];
const commonTools = [
  "production_context", "production_query",
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
  hook: [...commonTools, ...editorReadTools, "edit_project"],
  polish: [...commonTools, ...editorReadTools, "edit_project"],
  visual: ["production_repair_badge", "production_context", "production_save_draft", ...editorReadTools, "edit_project"],
};

/** Tool availability and native CLI capabilities are separate enforcement boundaries. */
export function stagePolicy(step: ProductionStep, mode: ProductionRequest["mode"] = "automatic") {
  const external = mode === "external_url" || mode === "spy_reference";
  const tools = new Set(toolsByStage[step]);
  // Only explicit external production may look up additional stored examples.
  for (const tool of referenceTools) tools.delete(tool);
  if (external && step === "analysis") tools.add("production_read_images");
  if (external && step === "production") for (const tool of referenceTools) tools.add(tool);
  if (mode === "automatic" && (step === "analysis" || step === "production")) tools.add("production_comparisons");
  if (step === "hook" || step === "polish") tools.delete("production_preview_project");
  if (step !== "visual") { tools.delete("preview_slide"); tools.delete("preview_slides"); }
  if (mode !== "automatic") tools.delete("production_change_direction");
  if (step === "visual" && mode === "past_post") {
    tools.add("production_read_project");
    tools.add("production_preview_project");
  }
  return {
    imageGeneration: step === "production",
    externalCollection: false,
    externalLimit: external && step === "production" ? REFERENCE_LIMIT : 0,
    webSearch: step === "production",
    shell: step === "production",
    tools,
  };
}
