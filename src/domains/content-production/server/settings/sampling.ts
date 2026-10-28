import type Database from "better-sqlite3";
import { defaultSampling, samplingSchema, type SamplingSettings } from "../../domain/references/sampling";
import { publishChange } from "../events";
export function readSampling(db: Database.Database): SamplingSettings {
  const row = db.prepare("SELECT document_json FROM content_production_settings WHERE id=1").get() as {document_json:string}|undefined;
  return row ? samplingSchema.parse(JSON.parse(row.document_json)) : {...defaultSampling};
}
export function saveSampling(db: Database.Database, value: SamplingSettings) {
  const settings = samplingSchema.parse(value);
  db.prepare("INSERT INTO content_production_settings(id,document_json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET document_json=excluded.document_json").run(JSON.stringify(settings));
  publishChange({kind:"library"});
  return settings;
}
