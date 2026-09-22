import { codexConnection } from "../codex/connection";
import { ContentJobRegistry } from "./registry";
import { ContentWorkflowService } from "./workflow";

const globalServices = globalThis as typeof globalThis & {
  contentStudioJobRegistry?: ContentJobRegistry;
};

export const contentJobRegistry = (globalServices.contentStudioJobRegistry ??=
  new ContentJobRegistry());

// The registry and Codex process must survive development reloads, but this
// stateless facade should be recreated so edited workflow methods take effect.
export const contentWorkflow = new ContentWorkflowService(
  codexConnection,
  contentJobRegistry,
);
