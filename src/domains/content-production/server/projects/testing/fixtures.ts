import type Database from "better-sqlite3";
import { createBlankDocument } from "@/domains/slideshow/editor/document";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";

export function seedLayoutSource(db: Database.Database, id="layout-project") {
  new ContentProjectStore(db).save({id,name:"Saved routine",aspectRatio:"4:5",slideCount:1,outputLanguage:"English",
    document:createBlankDocument({structure:"sequential",aspectRatio:"4:5",slideCount:1}),assets:[]});
  const logId=`log-${id}`;
  db.prepare("INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,created_at,updated_at) VALUES(?,?,?,'2026-10-25','now','now')")
    .run(logId,id,`https://example.com/${id}`);
  return {id:logId,project_id:id};
}
