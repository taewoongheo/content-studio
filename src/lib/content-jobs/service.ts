import { codexConnection } from "../codex/connection";
import { ContentJobRegistry } from "./registry";
import { ContentWorkflowService } from "./workflow";

const globalServices = globalThis as typeof globalThis & {
  contentStudioJobRegistry?: ContentJobRegistry;
  contentStudioWorkflow?: ContentWorkflowService;
};

export const contentJobRegistry = (globalServices.contentStudioJobRegistry ??=
  new ContentJobRegistry());

export const contentWorkflow = (globalServices.contentStudioWorkflow ??=
  new ContentWorkflowService(codexConnection, contentJobRegistry));
