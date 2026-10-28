import { z } from "zod";
import type { ProductionStep, Row, WorkDetail } from "../contracts";

export const stageReportSchema = z.object({
  headline: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(2000),
  sections: z.array(z.object({
    title: z.string().trim().min(1).max(100),
    paragraphs: z.array(z.string().trim().min(1).max(5000)).max(6),
    items: z.array(z.object({
      title: z.string().trim().max(180),
      body: z.string().trim().min(1).max(4000),
      quote: z.string().max(5000),
    }).strict()).max(12),
  }).strict()).max(7),
  next_actions: z.array(z.string().trim().min(1).max(800)).max(5),
}).strict();
export type StageReport = z.infer<typeof stageReportSchema>;
export const reportFields = ["analysis","reasoning","topic","message","content_type","answer","presentation","reason",
  "expected_response","goal_connection","difference_from_recent","research","sources","content","slide_plan","content_review",
  "review","direction_changes","completed_actions","remaining_actions"] as const;
export function reportError(context: Row): Row | undefined {
  const error = context.error;
  if (!error || typeof error !== "object") return;
  const record=error as Row;
  const failures=Array.isArray(record.tool_calls)?(record.tool_calls as Row[]).filter(call=>call.status==="failed").map(call=>call.message).filter(Boolean):[];
  return {message:record.message,causes:[...new Set(failures)]};
}
function meaningful(value: unknown): boolean {
  if(typeof value==="string")return !!value.trim();
  if(Array.isArray(value))return value.some(meaningful);
  return !!value&&typeof value==="object"&&Object.values(value).some(meaningful);
}
/** Includes source revisions for stale-response guards, never becomes a user-facing report. */
export function reportSourceKey(detail: WorkDetail, step: ProductionStep): string {
  const context=detail[step];
  if(!context)return "";
  const fields=Object.fromEntries(reportFields.filter(key=>context[key]!=null).map(key=>[key,context[key]]));
  const error=reportError(context);
  if(!meaningful(fields)&&!error)return "";
  const external=detail.external?.[step]??(step==="production"?detail.external?.analysis:null);
  return JSON.stringify({step,state:context.state,fields,error,external:external?.posts.map(post=>({id:post.id,title:post.title,topic:post.topic,caption:post.caption})),source:detail.input?.source});
}

/** Compact canvas cards also exclude machine identifiers and raw URLs. */
export function cleanCanvasText(value: unknown): string {
  return typeof value==="string"?value.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\b[a-f0-9]{32,64}\b|https?:\/\/\S+/gi,"").replace(/\[\s*\]|\(\s*\)/g,"").trim():"";
}
