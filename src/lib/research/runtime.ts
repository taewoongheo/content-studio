import { isAbsolute } from "node:path";

// Keep Python environments and native models outside Next's source graph.
// Like the database, their location must not depend on the launch directory.
export function researchRuntimeDirectory() {
  const override = process.env.CONTENT_STUDIO_RESEARCH_RUNTIME_DIR;
  if (override) {
    if (!isAbsolute(override)) throw new Error("CONTENT_STUDIO_RESEARCH_RUNTIME_DIR는 절대 경로여야 합니다.");
    return override;
  }
  return "/Users/taewoongheo/Projects/content-studio-workspace/.content-studio-research";
}
