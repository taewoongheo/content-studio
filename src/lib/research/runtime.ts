import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Keep Python environments and native models outside Next's source graph.
// Like the local database, these belong to the workspace beside the app.
export function researchRuntimeDirectory() {
  return process.env.CONTENT_STUDIO_RESEARCH_RUNTIME_DIR
    ? resolve(process.env.CONTENT_STUDIO_RESEARCH_RUNTIME_DIR)
    : join(dirname(realpathSync(process.cwd())), ".content-studio-research");
}
