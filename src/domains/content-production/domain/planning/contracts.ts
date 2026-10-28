import { z } from "zod";

const prose = z.string().trim().min(1);

/** Decision records capture consequential evidence, without prescribing case or candidate counts. */
export const analysisReasoningSchema = z.object({
  observations: z.array(z.object({
    source: prose.describe("Identify the inspected post and relevant slide/copy; connect it to a sources entry."),
    observation: prose.describe("What the viewer receives, the hook promise/body delivery and relevant observed response. Record facts, not inferred causes."),
  }).strict()).describe("Only cases that materially informed the decision; do not write a worksheet for every retrieved post."),
  interpretations: z.array(z.object({
    finding: prose.describe("A consequential conclusion about format/value or delivery; keep these explanations distinct."),
    support: prose.describe("Which observations support this interpretation and why; distinguish inference from fact."),
    limits: z.string().describe("Relevant counterexamples or limits to this conclusion. Empty when there is nothing material to add; do not invent objections."),
  }).strict()),
  candidates: z.array(z.object({
    direction: prose.describe("The candidate's substantive answer and format, within the start request's fixed constraints."),
    viewer_value: prose.describe("What the intended viewer would discover, compare, obtain or confirm."),
    assessment: prose.describe("Evidence-backed reason to select or reject this option, including meaningful weaknesses. No scoring rubric or fixed quota."),
  }).strict()),
}).strict();

export const slidePlanSchema = z.array(z.object({
  slide_id: prose,
  role: z.enum(["hook", "body", "cta"]),
  purpose: prose.describe("This slide's contribution to the selected answer and progression. Do not force the same information fields onto every page."),
  copy: z.array(prose).min(1).describe("Planned public-facing wording, including only information useful for this content."),
  visual: prose.describe("What the image explains and the subject/pose/equipment/composition needed to do so."),
}).strict()).min(1);

export const contentReviewSchema = z.object({
  assessment: prose.describe("Judge repetition, logical jumps, claim/evidence fit, hook/body agreement and image meaning against the actual draft. Do not search for missing explanations or expand text for completeness."),
  issues: z.array(z.object({
    location: prose,
    issue: prose,
    resolution: prose.describe("The actual correction or concrete reason the issue blocks completion."),
    status: z.enum(["resolved", "blocked"]),
  }).strict()).describe("Only actual problems found; [] when none. Do not invent repairs to demonstrate activity."),
}).strict();

export const firstDraftPlanningSchema = z.object({
  slide_plan: slidePlanSchema,
  content_review: contentReviewSchema,
}).strict();
