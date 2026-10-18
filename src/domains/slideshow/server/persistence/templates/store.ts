import type Database from "better-sqlite3";
import { SlideshowMetadataError } from "@/domains/slideshow/domain/errors";
import { templateSettingsSchema, type TemplateSettingsInput } from "../../../templates/metadata";
import type { SavedTemplateSummary } from "../../../domain/projects";
import { saveAssets, readAssets, readAsset, type SavedSlideshowAsset as SavedProjectAsset } from "../assets";
import type { EditorDocument } from "../../../editor/types";

type TemplateRow = { id: string; name: string; topic: string; message: string; composition: string;
  created_at: string; updated_at: string;
  aspect_ratio: string; slide_count: number; output_language: string; document_json: string };
const SUMMARY_COLUMNS = "id, name, topic, message, composition, created_at, updated_at, aspect_ratio, slide_count, output_language";
const summary = (row: TemplateRow): SavedTemplateSummary => ({ id: row.id, name: row.name, topic: row.topic, message: row.message,
  composition: row.composition, aspectRatio: row.aspect_ratio,
  slideCount: row.slide_count, outputLanguage: row.output_language, createdAt: row.created_at, updatedAt: row.updated_at });

export class ContentTemplateStore {
  constructor(readonly database: Database.Database) {}
  list(): SavedTemplateSummary[] {
    return (this.database.prepare(`SELECT ${SUMMARY_COLUMNS} FROM content_templates ORDER BY created_at, id`).all() as TemplateRow[]).map(summary);
  }
  getSummary(id: string) {
    const row = this.database.prepare(`SELECT ${SUMMARY_COLUMNS} FROM content_templates WHERE id = ?`).get(id) as TemplateRow | undefined;
    return row ? summary(row) : null;
  }
  get(id: string) { return this.getSummary(id); }
  getContent(id: string) {
    const row = this.database.prepare("SELECT * FROM content_templates WHERE id = ?").get(id) as TemplateRow | undefined;
    return row ? { ...summary(row), document: JSON.parse(row.document_json) as EditorDocument } : null;
  }
  read(id: string) {
    const content = this.getContent(id);
    if (!content) return null;
    return { ...content, assets: readAssets(this.database, "template", id) };
  }

  getAsset(id: string, assetId: string) {
    return readAsset(this.database, "template", id, assetId);
  }

  create(input: { id: string; name: string; topic: string; message: string; composition: string; document: EditorDocument; outputLanguage: string; assets: SavedProjectAsset[] }) {
    return this.database.transaction(() => {
      const now = new Date().toISOString();
      this.database.prepare(`INSERT INTO content_templates (id, name, topic, message, composition, aspect_ratio, slide_count, output_language, document_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.id, input.name, input.topic, input.message, input.composition,
        input.document.aspectRatio, input.document.slides.length, input.outputLanguage, JSON.stringify(input.document), now, now);
      saveAssets(this.database, "template", input.id, input.assets);
      return this.get(input.id)!;
    })();
  }
  save(input: { id: string; name: string; aspectRatio: string; slideCount: number; outputLanguage: string; document: unknown; assets: SavedProjectAsset[] }) {
    return this.database.transaction(() => {
      if (!this.get(input.id)) throw new SlideshowMetadataError("PROJECT_NOT_FOUND");
      this.database.prepare(`UPDATE content_templates SET name = ?, aspect_ratio = ?, slide_count = ?, output_language = ?, document_json = ?, updated_at = ? WHERE id = ?`)
        .run(input.name, input.aspectRatio, input.slideCount, input.outputLanguage, JSON.stringify(input.document), new Date().toISOString(), input.id);
      saveAssets(this.database, "template", input.id, input.assets);
      return this.get(input.id)!;
    })();
  }
  update(id: string, input: TemplateSettingsInput) {
    const settings = templateSettingsSchema.parse(input);
    return this.database.transaction(() => {
      const existing = this.get(id);
      if (!existing) throw new SlideshowMetadataError("PROJECT_NOT_FOUND");
      const composition = settings.composition ?? existing.composition;
      if (!composition.trim()) throw new SlideshowMetadataError("COMPOSITION_REQUIRED");
      this.database.prepare("UPDATE content_templates SET name = ?, topic = ?, message = ?, composition = ?, updated_at = ? WHERE id = ?")
        .run(settings.templateName ?? existing.name, settings.templateTopic ?? existing.topic, settings.templateMessage ?? existing.message, composition, new Date().toISOString(), id);
      return this.get(id)!;
    })();
  }
  rename(id: string, name: string) { this.update(id, { templateName: name }); }
  delete(id: string) {
    this.database.transaction(() => {
      if (!this.get(id)) throw new SlideshowMetadataError("PROJECT_NOT_FOUND");
      this.database.prepare("UPDATE content_projects SET template_id = NULL WHERE template_id = ?").run(id);
      this.database.prepare("DELETE FROM content_templates WHERE id = ?").run(id);
    })();
  }
}
