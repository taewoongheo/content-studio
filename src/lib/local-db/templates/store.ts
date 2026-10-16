import type Database from "better-sqlite3";
import { ProjectReuseError, projectReuseUpdateSchema, type ProjectReuseUpdate } from "@/lib/content-jobs/projects/composition";
import type { SavedProjectSummary } from "../projects/store";

type TemplateRow = { id: string; name: string; topic: string; message: string; composition: string;
  loop_order: number | null; created_at: string; updated_at: string;
  aspect_ratio: string; slide_count: number; output_language: string; published_at: string | null };

export class ContentTemplateStore {
  constructor(private readonly database: Database.Database) {}
  list(includeExcluded = false): SavedProjectSummary[] {
    const rows = this.database.prepare(`SELECT t.*, p.aspect_ratio, p.slide_count, p.output_language, p.published_at
      FROM content_templates t JOIN content_projects p ON p.id = t.id
      ${includeExcluded ? "" : "WHERE t.loop_order IS NOT NULL"} ORDER BY t.loop_order IS NULL, t.loop_order, t.created_at, t.id`).all() as TemplateRow[];
    return rows.map(row => ({ id: row.id, name: row.name, topic: row.topic, message: row.message,
      composition: row.composition, templateOrder: row.loop_order,
      isTemplate: true, registeredTemplateName: row.name, sourceTemplateProjectId: null, sourceTemplateName: null,
      sourceTemplateExcluded: false, publishedAt: row.published_at, aspectRatio: row.aspect_ratio,
      slideCount: row.slide_count, outputLanguage: row.output_language, createdAt: row.created_at, updatedAt: row.updated_at }));
  }
  get(id: string) { return this.list(true).find(template => template.id === id) ?? null; }

  update(id: string, input: ProjectReuseUpdate) {
    const settings = projectReuseUpdateSchema.parse(input);
    return this.database.transaction(() => {
      const project = this.database.prepare("SELECT id, name, topic, message FROM content_projects WHERE id = ?").get(id) as { id: string; name: string; topic: string; message: string } | undefined;
      if (!project) throw new ProjectReuseError("PROJECT_NOT_FOUND");
      const existing = this.get(id);
      if (settings.isTemplate === false || settings.templateOrder === null) {
        if (existing) this.delete(id);
        return null;
      }
      if (!existing && settings.isTemplate !== true && typeof settings.templateOrder !== "number")
        throw new ProjectReuseError("INVALID_METADATA", "먼저 템플릿으로 등록해 주세요.");
      const composition = settings.composition ?? existing?.composition ?? "";
      if (!composition.trim()) throw new ProjectReuseError("COMPOSITION_REQUIRED");
      const active = this.list();
      let order = settings.templateOrder === undefined ? existing?.templateOrder ?? null : settings.templateOrder;
      if (order === null && (!existing || settings.isTemplate === true)) order = active.length + 1;

      const ids = active.filter(template => template.id !== id).map(template => template.id);
      if (order !== null) {
        if (order > ids.length + 1) throw new ProjectReuseError("INVALID_METADATA", "템플릿 순서는 루프 범위 안에서 지정해 주세요.");
        ids.splice(order - 1, 0, id);
      }
      const now = new Date().toISOString();
      this.database.prepare(`INSERT INTO content_templates (id, name, topic, message, composition, loop_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?) ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, topic = excluded.topic, message = excluded.message, composition = excluded.composition,
        updated_at = excluded.updated_at`).run(id,
        settings.templateName ?? existing?.name ?? project.name,
        settings.templateTopic ?? existing?.topic ?? (project.topic || project.name),
        settings.templateMessage ?? existing?.message ?? (project.message || `${project.name}의 내용을 전달한다.`),
        composition, now, now);
      // Registration detaches the parent via a DB trigger; it never changes post metadata.
      this.applyOrder(ids);
      return this.get(id)!;
    })();
  }

  reorder(ids: string[], expectedIds: string[]) {
    return this.database.transaction(() => {
      const current = this.list().map(template => template.id);
      if (current.length !== expectedIds.length || current.some((id, index) => id !== expectedIds[index]))
        throw new ProjectReuseError("INVALID_METADATA", "루프가 변경됐습니다. 최신 목록에서 다시 이동해 주세요.");
      if (ids.length !== current.length || new Set(ids).size !== ids.length || ids.some(id => !current.includes(id)))
        throw new ProjectReuseError("INVALID_METADATA", "현재 루프의 모든 템플릿을 한 번씩 지정해 주세요.");
      this.applyOrder(ids);
      return this.list();
    })();
  }
  private applyOrder(ids: string[]) {
    this.database.prepare("UPDATE content_templates SET loop_order = NULL WHERE loop_order IS NOT NULL").run();
    const update = this.database.prepare("UPDATE content_templates SET loop_order = ?, updated_at = ? WHERE id = ?");
    const now = new Date().toISOString();
    ids.forEach((id, index) => update.run(index + 1, now, id));
  }
  delete(id: string) {
    this.database.transaction(() => {
      if (!this.get(id)) throw new ProjectReuseError("PROJECT_NOT_FOUND");
      this.database.prepare("UPDATE content_projects SET template_id = NULL WHERE template_id = ?").run(id);
      this.database.prepare("DELETE FROM content_templates WHERE id = ?").run(id);
      this.applyOrder(this.list().map(template => template.id));
    })();
  }
}
