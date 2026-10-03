import { codexConnection } from "../../codex/connection/connection";
import { ContentJobRegistry, reuseContentJobRegistry } from "./registry";
import { ContentWorkflowService } from "./workflow";
import { EditorWorkflowService } from "../editor/workflow/workflow";

const globalServices = globalThis as typeof globalThis & {
  contentStudioJobRegistry?: ContentJobRegistry;
};

// Next.js reloads this module in development but retains the global registry.
// Refresh its methods too, so older jobs receive the current snapshot shape.
export const contentJobRegistry = (globalServices.contentStudioJobRegistry =
  reuseContentJobRegistry(globalServices.contentStudioJobRegistry));

// The registry and Codex process must survive development reloads, but this
// stateless facade should be recreated so edited workflow methods take effect.
export const contentWorkflow = new ContentWorkflowService(
  codexConnection,
  contentJobRegistry,
);

export const editorWorkflow = new EditorWorkflowService(
  codexConnection,
  contentJobRegistry,
);
