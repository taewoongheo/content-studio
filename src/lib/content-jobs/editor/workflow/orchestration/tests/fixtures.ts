import { createDocumentFromAnalysis } from "../../../document";
import type { EditorAnalysis } from "../../../types";
import type { ContentJobInput } from "../../../../domain/types";
import { ContentJobRegistry } from "../../../../workflow/registry";
export const input: ContentJobInput = {
  model: "gpt-6-luna", structure: "repeating", aspectRatio: "9:16", slideCount: 4,
  outputLanguage: "English", referenceImages: [],
  productContext: { name: "Demo", description: "운동 앱", audience: "사용자", constraints: "" },
};
export const analysis: EditorAnalysis = {
  formatNotes: { visualRules: "큰 제목", writingStyle: "짧게", hookPattern: "대조", bodyProgression: "반복" },
  elements: [{ id: "title", name: "제목", role: "핵심 내용", kind: "text", sourceImageId: "image-1",
    frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, style: { color: "#111111", backgroundColor: "transparent",
      fontSize: 36, lineHeight: 1.2, fontWeight: 700, textAlign: "center", borderRadius: 0,
      borderEnabled: false, borderColor: "#111111", borderWidth: 2, fontFamily: "sans-serif", imageFit: "contain" } }],
  slides: ["hook", "body", "body", "cta"].map((role, i) => ({ imageId: `image-${i + 1}`,
    role: role as "hook" | "body" | "cta", backgroundColor: "#FFFFFF", elementIds: ["title"], visuals: [] })),
};
export function readyJob() {
  const registry = new ContentJobRegistry({ createId: () => "job" });
  registry.add(input, "thread-1");
  registry.update("job", (job) => {
    job.editor.status = "ready";
    job.editor.document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  });
  return { registry, job: registry.getRecord("job") };
}
