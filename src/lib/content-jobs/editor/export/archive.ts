import JSZip from "jszip";
import { readEditorAsset } from "../assets";
import { validateEditorDocument } from "../document";
import type { EditorDocument } from "../types";
import { ContentJobError, ContentJobRegistry } from "../../workflow/registry";
import { renderSlide, type ReadExportAsset } from "./render";

export async function createEditorArchive(document: EditorDocument, readAsset: ReadExportAsset) {
  const errors = validateEditorDocument(document);
  if (errors.length > 0) throw new Error(errors.join(" "));
  const zip = new JSZip();
  const digits = Math.max(2, String(document.slides.length).length);
  for (const [index, slide] of document.slides.entries()) {
    const image = await renderSlide(document, slide, readAsset);
    zip.file(`slide-${String(index + 1).padStart(digits, "0")}.png`, image, { binary: true, compression: "STORE" });
  }
  return Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "STORE", streamFiles: true }));
}

export async function exportContentJob(registry: ContentJobRegistry, jobId: string) {
  const job = registry.getRecord(jobId);
  const document = job.editor.document;
  if (!document || job.editor.status !== "ready")
    throw new ContentJobError("INVALID_STAGE", "내보낼 편집 문서가 준비되지 않았습니다.");
  return createEditorArchive(structuredClone(document), (assetId) => readEditorAsset(registry, jobId, assetId));
}
