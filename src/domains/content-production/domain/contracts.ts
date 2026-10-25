import type { ExternalContext, ReferenceStep } from "./references/context";
import { z } from "zod";
import { contentMetadataSchema } from "@/domains/content-metadata/schema";

export const stepSchema = z.enum(["analysis", "production", "hook", "visual"]);
export type ProductionStep = z.infer<typeof stepSchema>;
export const productionSteps = [
  { id: "analysis", label: "분석 및 제작 방향" },
  { id: "production", label: "초안 제작" },
  { id: "hook", label: "훅 검토·수정" },
  { id: "visual", label: "시각 검증·수정" },
] as const;
export const directionSchema = contentMetadataSchema.extend({
  answer: z.string().trim().min(1),
  presentation: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  expected_response: z.string().trim().min(1),
  goal_connection: z.string().trim().min(1),
  difference_from_recent: z.string().trim().min(1),
});
export type Direction = z.infer<typeof directionSchema>;
export const sourceSchema = z
  .object({
    kind: z.enum(["log", "reference", "url"]),
    id: z.string().optional(),
    url: z.string().url().optional(),
    part: z.string(),
    used_for: z.string(),
    visual_set_id: z.string().optional(),
  })
  .refine((s) => !!s.id || !!s.url, "자료 ID 또는 URL이 필요합니다.");
export const researchSchema = z.object({
  question: z.string(),
  source: z.string(),
  finding: z.string(),
  judgment: z.string(),
});
const progress = {
  research: z.array(researchSchema).optional(),
  sources: z.array(sourceSchema).optional(),
  completed_actions: z.array(z.string()).optional(),
  remaining_actions: z.array(z.string()).optional(),
};
export const reviewDraftPatchSchema = z.object({
  review: z.string().optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  ...progress,
}).strict();
export const analysisPatchSchema = directionSchema
  .partial()
  .extend({ analysis: z.string().optional(), ...progress })
  .strict();
export const productionPatchSchema = z
  .object({
    content: z.record(z.string(), z.unknown()).optional(),
    direction_changes: z.string().optional(),
    ...progress,
  })
  .strict();
export const analysisResultSchema = directionSchema
  .extend({
    analysis: z.string().trim().min(1),
    sources: z.array(sourceSchema),
  })
  .strict();
export const productionResultSchema = z
  .object({
    project_id: z.string().min(1),
    summary: z.record(z.string(), z.unknown()),
    sources: z.array(sourceSchema),
    reviewed_slide_ids: z.array(z.string()).min(1),
    reviewed_revision: z.number().int().nonnegative(),
  })
  .strict();
export type Row = Record<string, unknown>;
export interface WorkItem extends Row {
  id: string;
  log_id: string;
  current_step: ProductionStep;
  state: string;
  created_at: string;
  updated_at: string;
  project_id: string | null;
  topic: string | null;
  content_type: string | null;
}
export interface WorkDetail {
  external?: Partial<Record<ReferenceStep, ExternalContext | null>>;
  task: WorkItem;
  analysis: Row;
  production: Row | null;
  log: Row;
  hook?: Row | null;
  visual?: Row | null;
}
export interface ChangeEvent {
  task_id?: string;
  step?: ProductionStep;
  kind: "saved" | "state" | "removed" | "sync" | "library" | "reset";
  detail?: string;
}
