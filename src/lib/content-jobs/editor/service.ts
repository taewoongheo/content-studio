import { applyEditorCommands, validateEditorDocument } from "./document";
import { validateEditorCommands } from "./schema";
import { ContentJobError, type ContentJobRegistry } from "../workflow/registry";
export class EditorService {
  constructor(readonly registry: ContentJobRegistry) {}
  private requireRevision(id: string, expected: number) {
    const job = this.registry.getRecord(id);
    if (job.editor.revision !== expected)
      throw new ContentJobError("INVALID_STAGE", "편집 문서가 변경되었습니다. 최신 결과를 확인해 주세요.");
    return job;
  }
  applyCommands(id: string, commands: unknown, revision: number) {
    const job = this.requireRevision(id, revision);
    const checked = validateEditorCommands({ commands });
    if (!checked.ok) throw new ContentJobError("INVALID_OUTPUT", checked.errors.join(" "));
    let next;
    try {
      next = applyEditorCommands(job.editor.document, checked.value.commands);
      const errors = validateEditorDocument(next);
      if (errors.length) throw new Error(errors.join(" "));
      const images = new Set(next.elements.filter((element) => element.kind === "image").map((element) => element.id));
      const assets = new Set(job.assets.map((asset) => asset.id));
      if (next.slides.some((slide) => slide.placements.some((placement) =>
        images.has(placement.elementId) && placement.value && !assets.has(placement.value))))
        throw new Error("슬라이드에서 사용하는 이미지를 찾을 수 없습니다.");
    } catch (error) {
      throw new ContentJobError("INVALID_OUTPUT", error instanceof Error ? error.message : "편집 내용을 확인해 주세요.");
    }
    return this.registry.update(id, (current) => {
      current.editorHistory.push(structuredClone(current.editor.document));
      current.editor.document = next;
      current.slideCount = next.slides.length;
      current.aspectRatio = next.aspectRatio;
      current.editor.revision += 1;
    });
  }
  undo(id: string, revision: number) {
    const job = this.requireRevision(id, revision);
    if (!job.editorHistory.length) throw new ContentJobError("INVALID_STAGE", "되돌릴 수정이 없습니다.");
    return this.registry.update(id, (current) => {
      current.editor.document = current.editorHistory.pop()!;
      current.slideCount = current.editor.document.slides.length;
      current.aspectRatio = current.editor.document.aspectRatio;
      current.editor.revision += 1;
    });
  }
}
