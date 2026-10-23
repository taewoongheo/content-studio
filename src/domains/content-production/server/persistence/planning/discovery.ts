import { readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { ApifyPhotoSearchClient } from "@/domains/research/server/apify/photo-search";
import type { DiscoveryBatch } from "../../../domain/discovery";
import { collectVisuals, saveVisuals } from "../../publication/visuals";
import { productionRuntimePath } from "../../settings";

export const discoveryQueries = ["strength training", "weight training", "muscle building", "gym workout", "resistance training"] as const;
export function nextDiscoveryQuery(previous: unknown) {
  const index = discoveryQueries.findIndex(query => query === previous);
  return discoveryQueries[(index + 1) % discoveryQueries.length];
}
function readPrevious() {
  try { return JSON.parse(readFileSync(productionRuntimePath("discovery-query.json"), "utf8")).query; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
function savePrevious(query: string) {
  const path = productionRuntimePath("discovery-query.json"), temporary = `${path}.${randomUUID()}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  try { writeFileSync(temporary, JSON.stringify({ query }), { mode: 0o600 }); renameSync(temporary, path); }
  finally { rmSync(temporary, { force: true }); }
}
export async function collectDiscovery(
  db: Database.Database,
  client = new ApifyPhotoSearchClient(),
  capture = collectVisuals,
): Promise<DiscoveryBatch> {
  const query = nextDiscoveryQuery(readPrevious());
  const candidates = await client.search(query);
  const posts = await Promise.all(candidates.map(async ({ images, ...post }) => {
    try {
      const slides = await capture(images);
      return { ...post, visual_set_id: saveVisuals(db, { kind: "reference", url: post.url, slides }), slide_count: slides.length, image_error: null };
    } catch {
      return { ...post, visual_set_id: null, slide_count: 0, image_error: "Slide images could not be preserved. Do not infer their content from the caption." };
    }
  }));
  savePrevious(query);
  return { query, collected_at: new Date().toISOString(), posts };
}
