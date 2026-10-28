import { z } from "zod";
import type { Row } from "../contracts";
export const samplingSchema = z.object({ internalCandidates: z.number().int().min(5).max(1000), externalCandidates: z.number().int().min(5).max(1000) });
export type SamplingSettings = z.infer<typeof samplingSchema>;
export const defaultSampling: SamplingSettings = { internalCandidates: 10, externalCandidates: 10 };

/** Absolute recent five first; performance candidates exclude those five. */
export function sampleReferences(rows: Row[], candidates: number, dateField: string, random = Math.random): Row[] {
  const recent = [...rows].sort((a,b) => String(b[dateField] ?? "").localeCompare(String(a[dateField] ?? "")) || String(a.id).localeCompare(String(b.id))).slice(0,5);
  const recentIds = new Set(recent.map(row => row.id));
  const pool = rows.filter(row => !recentIds.has(row.id) && typeof row.engagement_rate === "number")
    .sort((a,b) => Number(b.engagement_rate)-Number(a.engagement_rate) || String(a.id).localeCompare(String(b.id))).slice(0,candidates);
  for (let i=pool.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  return [...pool.slice(0,5).map(row => ({...row,selection_group:"performance"})), ...recent.map(row => ({...row,selection_group:"recent"}))];
}
