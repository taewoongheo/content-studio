import { z } from "zod";
export const topicCandidateSchema = z.object({
  topic: z.string().min(1),
  reader_question: z.string().min(1),
  content_type: z.string().min(1),
  message: z.string().min(1),
  rationale: z.string().min(1),
  reference_ids: z.array(z.string()).min(1),
}).strict();
export const topicPoolSchema = z.object({ candidates: z.array(topicCandidateSchema).min(1) }).strict();
export const topicMatchSchema = z.object({ matches: z.array(z.object({
    candidate_id: z.string(), direct_log_ids: z.array(z.string()), related_log_ids: z.array(z.string()), reason: z.string(),
  }).strict()) }).strict();
export type TopicCandidate = z.infer<typeof topicCandidateSchema> & {
  id: string;
};
export type TopicMatch = z.infer<typeof topicMatchSchema>["matches"][number];
export type TopicLane = "proven" | "exploration";
export type TopicStatus = "proven" | "untried" | "inconclusive";
export type TopicAssignment = {
  candidate: TopicCandidate;
  requested_lane: TopicLane;
  selected_lane: TopicLane;
  status: TopicStatus;
  direct_log_ids: string[];
  related_log_ids: string[];
  evidence: string;
  fallback: string | null;
};
