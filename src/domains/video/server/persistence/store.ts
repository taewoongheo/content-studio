import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { parseSavedVideoDocument, videoDocumentSchema, videoDuration, type VideoAsset, type VideoDocument, type VideoSummary } from "@/domains/video/domain/model";

import { VIDEO_SCHEMA } from "@/domains/video/server/persistence/schema";
type Row = { id: string; name: string; document_json: string; revision: number; updated_at: string };
export class VideoStore {
  constructor(private db: Database.Database) { db.exec(VIDEO_SCHEMA); }
  list(): VideoSummary[] {
    return (this.db.prepare("SELECT * FROM video_projects ORDER BY updated_at DESC, id").all() as Row[]).map(row => {
      const doc = parseSavedVideoDocument(JSON.parse(row.document_json));
      return { id: row.id, name: row.name, projectType: "video", revision: row.revision, width: doc.width, height: doc.height, fps: doc.fps, duration: videoDuration(doc), updatedAt: row.updated_at };
    });
  }
  get(id: string) {
    const row = this.db.prepare("SELECT * FROM video_projects WHERE id = ?").get(id) as Row | undefined;
    return row ? { id: row.id, name: row.name, revision: row.revision, document: parseSavedVideoDocument(JSON.parse(row.document_json)) } : null;
  }
  save(id: string, name: string, document: VideoDocument, revision: number) {
    const doc = videoDocumentSchema.parse(document);
    if (!name.trim() || name.trim().length > 120) throw new Error("이름을 120자 이하로 입력해 주세요.");
    for (const l of doc.layers) if ("assetId" in l) {
      const asset = this.db.prepare("SELECT mime_type AS type FROM video_project_assets WHERE project_id=? AND id=?").get(id, l.assetId) as { type: string } | undefined;
      if (!asset || !asset.type.startsWith(`${l.kind}/`)) throw new Error("요소에 맞는 미디어 파일을 찾을 수 없습니다.");
    }
    this.db.prepare(`INSERT INTO video_projects (id,name,document_json,revision,updated_at) VALUES (?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,document_json=excluded.document_json,revision=excluded.revision,updated_at=excluded.updated_at`)
      .run(id, name.trim(), JSON.stringify(doc), revision, new Date().toISOString());
  }
  assets(id: string): VideoAsset[] {
    return this.db.prepare("SELECT id, name, mime_type AS type, length(data) AS size FROM video_project_assets WHERE project_id=?").all(id) as VideoAsset[];
  }
  asset(projectId: string, id: string) {
    return this.db.prepare("SELECT id, name, mime_type AS type, data FROM video_project_assets WHERE project_id=? AND id=?").get(projectId, id) as { id: string; name: string; type: string; data: Buffer } | undefined;
  }
  addAsset(projectId: string, name: string, type: string, bytes: Buffer) {
    const id = randomUUID();
    this.db.prepare("INSERT INTO video_project_assets VALUES (?,?,?,?,?)").run(projectId, id, name, type, bytes);
    return { id, name, type, size: bytes.length };
  }
  rename(id: string, name: string) {
    if (!name.trim() || name.trim().length > 120) throw new Error("이름을 120자 이하로 입력해 주세요.");
    this.db.prepare("UPDATE video_projects SET name=?, updated_at=? WHERE id=?").run(name.trim(), new Date().toISOString(), id);
  }
  delete(id: string) { this.db.prepare("DELETE FROM video_projects WHERE id=?").run(id); }
  clone(id: string) {
    const source = this.get(id);
    if (!source) throw new Error("프로젝트를 찾을 수 없습니다.");
    const copyId = randomUUID();
    this.db.transaction(() => {
      this.db.prepare("INSERT INTO video_projects VALUES (?,?,?,?,?)").run(copyId, `${source.name.slice(0, 115)} 복사본`, JSON.stringify(source.document), 0, new Date().toISOString());
      this.db.prepare("INSERT INTO video_project_assets SELECT ?,id,name,mime_type,data FROM video_project_assets WHERE project_id=?").run(copyId, id);
    })();
    return copyId;
  }
}
