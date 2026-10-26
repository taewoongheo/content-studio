import { readContentMetadata } from "@/domains/content-metadata/schema";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { createContentProject, saveContentProject } from "@/domains/slideshow/projects/service";
import { validateEditorDocument } from "@/domains/slideshow/editor/document";
import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { OperationError } from "@/lib/errors/operation";
import { ProductionStore } from "../persistence/store";
import { publishChange } from "../events";

/** Copy saved visual structure, not unsaved source edits, old copy or source image assets. */
export function cloneTaskProject(store: ProductionStore, taskId: string, sourceProjectId: string, reason: string) {
  const detail = store.assertActive(taskId,"production");
  if (detail.task.project_id) return {projectId:detail.task.project_id,reused:true};
  if (!reason.trim()) throw new Error("배치를 선택한 이유가 필요합니다.");
  const source = store.analysisInputs(taskId).find(row => row.project_id === sourceProjectId);
  if (!source) throw new OperationError("LAYOUT_SOURCE_NOT_ASSIGNED", "이번 분석에 전달된 내부 게시글 안에서 복제 대상을 선택해 주세요.");
  if (!store.db.prepare("SELECT 1 FROM content_creation_logs WHERE id=? AND project_id=? AND post_url IS NOT NULL").get(source.id,sourceProjectId))
    throw new OperationError("LAYOUT_SOURCE_NOT_PUBLISHED", "현재 게시된 내부 콘텐츠만 배치 원본으로 사용할 수 있습니다.");
  const projects = new ContentProjectStore(store.db);
  const saved = projects.getContent(sourceProjectId);
  if (!saved) throw new OperationError("LAYOUT_SOURCE_MISSING", "원본 게시글을 찾을 수 없습니다.");
  const document = structuredClone(saved.document) as EditorDocument;
  const errors = validateEditorDocument(document);
  if (errors.length) throw new OperationError("LAYOUT_SOURCE_INVALID", "원본 게시글의 슬라이드 구조가 올바르지 않습니다.", {errors});
  const kinds = new Map(document.elements.map(element => [element.id,element.kind]));
  for (const slide of document.slides) {
    delete slide.name;
    for (const placement of slide.placements) {
      const kind = kinds.get(placement.elementId);
      if (kind === "image" || (kind === "text" && placement.value.trim() !== "LIFTCODE")) {
        placement.value = "";
        delete placement.textColors;
        delete placement.textWeights;
      }
    }
  }
  return contentJobRegistry.transaction(() => store.db.transaction(() => {
    const metadata = readContentMetadata(detail.log),now = new Date().toISOString();
    const job = createContentProject(contentJobRegistry,{name:metadata.topic,structure:document.structure,
      aspectRatio:document.aspectRatio,slideCount:document.slides.length,outputLanguage:"English"},{projects});
    contentJobRegistry.update(job.id,record => {record.editor.document=document;});
    saveContentProject(contentJobRegistry,job.id,metadata.topic,{projects});
    projects.updateMetadata(job.id,metadata);
    const sourceRecord = {kind:"log",id:String(source.id),part:"Saved layout structure, typography and spacing",used_for:reason.trim()};
    store.db.prepare("UPDATE content_drafts SET project_id=?,updated_at=? WHERE id=?").run(job.id,now,taskId);
    store.db.prepare("UPDATE content_production_drafts SET sources_json=?,updated_at=? WHERE draft_id=?")
      .run(JSON.stringify([...(detail.production?.sources as unknown[] ?? []),sourceRecord]),now,taskId);
    store.db.prepare("UPDATE content_creation_logs SET sources_json=?,updated_at=? WHERE id=?")
      .run(JSON.stringify([...(detail.log.sources as unknown[]),sourceRecord]),now,detail.task.log_id);
    contentJobRegistry.afterCommit(()=>publishChange({task_id:taskId,step:"production",kind:"saved"}));
    return {projectId:job.id,sourceProjectId,reused:false};
  })());
}
