import { validateEditorDocument } from "../editor/document";
import type { EditorDocument } from "../editor/types";
import { ContentJobError, type ContentJobRegistry } from "../workflow/registry";
import { AssetStore } from "@/lib/local-db/assets";
import { getLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore, type SavedProjectAsset } from "@/lib/local-db/projects/store";
import { notifyProjectsChanged } from "./events";

export function defaultProjectStores() {
  const database = getLocalDatabase();
  return {
    projects: new ContentProjectStore(database),
    assets: new AssetStore(database),
  };
}

function projectAssetIds(document: EditorDocument) {
  const imageElementIds = new Set(document.elements
    .filter((element) => element.kind === "image")
    .map((element) => element.id));
  return [...new Set(document.slides.flatMap((slide) => slide.placements
    .filter((placement) => imageElementIds.has(placement.elementId) && placement.value)
    .map((placement) => placement.value)))];
}

function readProjectAsset(assetId: string, store: AssetStore): SavedProjectAsset {
  const metadata = store.get(assetId);
  const image = store.readImage(assetId);
  if (!metadata || !image)
    throw new ContentJobError("JOB_NOT_FOUND", "슬라이드에서 사용하는 이미지를 찾을 수 없습니다.");
  return {
    assetId,
    name: metadata.name,
    description: metadata.description,
    type: image.type,
    bytes: image.bytes,
  };
}

function parseDocument(value: unknown): EditorDocument {
  if (!value || typeof value !== "object" || !("slides" in value) || !("elements" in value))
    throw new Error("저장된 편집 문서를 읽을 수 없습니다.");
  const document = value as EditorDocument;
  let errors: string[];
  try {
    errors = validateEditorDocument(document);
  } catch {
    throw new Error("저장된 편집 문서가 올바르지 않습니다.");
  }
  if (errors.length > 0)
    throw new Error(`저장된 편집 문서가 올바르지 않습니다: ${errors[0]}`);
  return document;
}

export function saveContentProject(
  registry: ContentJobRegistry,
  jobId: string,
  name: string,
  stores = defaultProjectStores(),
) {
  const record = registry.getRecord(jobId);
  const document = record.editor.document;
  if (!document)
    throw new ContentJobError("INVALID_STAGE", "편집 문서가 준비된 뒤 저장해 주세요.");
  const errors = validateEditorDocument(document);
  if (errors.length > 0)
    throw new ContentJobError("INVALID_OUTPUT", `편집 문서를 저장할 수 없습니다: ${errors[0]}`);
  const saved = stores.projects.save({
    id: record.id,
    name,
    aspectRatio: document.aspectRatio,
    slideCount: document.slides.length,
    outputLanguage: record.outputLanguage,
    document,
    assets: projectAssetIds(document).map((assetId) => readProjectAsset(assetId, stores.assets)),
  });
  registry.update(jobId, (job) => { job.name = saved.name; job.savedRevision = job.editor.revision; });
  registry.afterCommit(notifyProjectsChanged);
  return saved;
}

export function loadContentProject(
  registry: ContentJobRegistry,
  projectId: string,
  stores = defaultProjectStores(),
) {
  if (registry.has(projectId)) return registry.get(projectId);
  const project = stores.projects.get(projectId);
  if (!project)
    throw new ContentJobError("JOB_NOT_FOUND", "저장된 프로젝트를 찾을 수 없습니다.");
  const document = parseDocument(project.document);
  const assets = project.assets.map((asset) => stores.assets.restore({
    id: asset.assetId,
    name: asset.name,
    description: asset.description,
    type: asset.type,
    bytes: asset.bytes,
  }));
  const created = registry.add({
    structure: document.structure,
    aspectRatio: document.aspectRatio,
    slideCount: document.slides.length,
    outputLanguage: project.outputLanguage,
  }, project.id);
  return registry.update(created.id, (job) => {
    job.name = project.name;
    job.editor.document = structuredClone(document);
    job.editor.revision = 0;
    job.savedRevision = 0;
    job.assets = assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      size: asset.size,
    }));
  });
}

/** Clone the current draft when available; loading a saved source never discards a draft. */
export function createContentProject(
  registry: ContentJobRegistry,
  input: { name?: string; sourceProjectId?: string; aspectRatio?: EditorDocument["aspectRatio"];
    slideCount?: number; structure?: EditorDocument["structure"]; outputLanguage?: string },
  stores = defaultProjectStores(),
) {
  const source = input.sourceProjectId
    ? loadContentProject(registry, input.sourceProjectId, stores) : null;
  if (source && (input.aspectRatio || input.slideCount !== undefined || input.structure || input.outputLanguage))
    throw new ContentJobError("INVALID_OUTPUT", "복제할 때는 원본 설정을 사용합니다. 생성 후 편집해 주세요.");
  const created = registry.add(source ? {
    structure: source.structure, aspectRatio: source.aspectRatio,
    slideCount: source.slideCount, outputLanguage: source.outputLanguage,
  } : {
    structure: input.structure ?? "sequential", aspectRatio: input.aspectRatio ?? "4:5",
    slideCount: input.slideCount ?? 6, outputLanguage: input.outputLanguage ?? "English",
  });
  return registry.update(created.id, (job) => {
    job.name = input.name ?? (source?.name ? `${source.name.slice(0, 115)} 복사본` : "새 프로젝트");
    if (source) {
      job.editor.document = structuredClone(source.editor.document);
      job.assets = structuredClone(source.assets);
    }
  });
}
