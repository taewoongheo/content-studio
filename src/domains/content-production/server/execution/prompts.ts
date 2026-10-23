import type { ProductionStep } from "../../domain/contracts";
const directionKeys = [
  "topic",
  "content_type",
  "message",
  "answer",
  "presentation",
  "reason",
  "expected_response",
  "goal_connection",
  "difference_from_recent",
];
const stringField = { type: "string" };
export function resultSchema(step: ProductionStep) {
  const properties =
    step === "analysis"
      ? Object.fromEntries(
          [...directionKeys, "analysis", "sources_json"].map((key) => [
            key,
            stringField,
          ]),
        )
      : {
          project_id: stringField,
          summary_json: stringField,
          sources_json: stringField,
          reviewed_slide_ids: { type: "array", items: stringField },
          reviewed_revision: { type: "integer" },
        };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
export function stagePrompt(taskId: string, step: ProductionStep) {
  return `You are producing ONE LiftCode TikTok slideshow for task ${taskId}. Current stage: ${step}.
Goal: bring people who fit LiftCode to the app and installation. Read liftcode.md, docs/content-guidelines.md and docs/research-guidelines.md. Automated production has user authorization to choose content and create without a template. There is no human in this CLI run; research failures must be reported honestly.
Write ALL saved prose in English: analysis, every direction field, research questions/findings/judgments, source descriptions, action lists, change reasons, content, slide copy, project metadata and final summaries. Translate non-English evidence into English when describing it; retain original URLs/IDs. The server rejects detected non-English prose with ENGLISH_REQUIRED before writing. Correct the named field and retry. Korean is a separate display-only translation; never use it as a production input.
Use the production MCP server. First call production_context. Read production_query(kind="logs") without a query for the initial comparison pool: up to 12 best posts by (likes+comments+saves)/views, then up to 12 newest other posts by actual publication time, with no duplicates. Use both performance and recent groups; a high rate alone does not establish causation or app installs. You may query data whenever useful; keyword queries narrow eligible logs before the same selection. For topics, hooks and presentation, use ONLY your own published logs and references explicitly selected by the user; use production_read_project and production_preview_project to read saved source documents/images without opening their editors, and improve the answer for this audience. Use production_read_images for stored external/published slide sets. Never call open_project for a source; editor tools are only for the project being produced. Do not search TikTok, Instagram or other social feeds for new content ideas, visual formats or reference slides.
External research is optional in either stage. Investigate only questions needed for the current content; examples include: (1) verify a factual, scientific or quantitative claim against original papers or official sources; (2) investigate community experience about execution, equipment or real-world obstacles that papers may not address; (3) understand how target users describe their situation, frustration or desired outcome. These are examples, not an exhaustive list, classification scheme or required checklist. Research none, one or several questions as needed. Use native web search for content-specific questions, not broad content-idea searches. Community anecdotes are experience, not proof of training effects or representative user demand. Lack of a paper does not make a practical tip false, but does not prove it works; state its context and avoid unsupported efficacy claims. Existing relevant evidence may be reused after checking applicability. If a necessary claim cannot be verified, narrow it, omit it or record the unresolved question; never invent support, metrics, images or prior user feedback.
Save progress frequently using production_save_draft: research questions/results/sources/judgments, completed/remaining actions, partial analysis/direction or content. Do not directly write SQLite or source files. Do not install packages, commit, use worktrees, launch other agents or modify application code. Use API/MCP only for project changes. Ordinary shell is read-only for reading docs and local assets.
Compare other draft CONTENT and published posts from the last 24h with production_comparisons at topic choice, before saving real draft, and before completion. Same topic AND content type counts as duplicate. First saved actual content keeps it; later draft changes. Unfinished ideas do not reserve topics. Use production_change_direction for collisions (overwrite, no abandoned idea history) or research-driven changes (keep original and record reasons). Good performance is evidence, not an inherited limit on future topics. Describe the new answer readers receive compared with recent posts. No mandatory narrative sequence.
${step === "analysis" ? `Analyze published past logs and selected references, investigate if useful, decide one topic/answer/presentation. Save analysis and direction to analysis draft. Do NOT create or edit a project. Return analysis and every direction field as strings; sources_json is a JSON-encoded array of {kind:log|reference|url,id or url,part,used_for,optional visual_set_id}. Your final response is validated and committed by the harness before production begins.` : `Read the confirmed analysis and direction, plus your production draft to resume. If no project is linked call production_create_project (reuses task project after resume). Write hook/body/CTA and visual layout through editing tools; set actual topic/message metadata. Use production_import_image to reuse an existing project asset or stored reference slide in an image placement; it imports through the app and cleans temporary files. Use production_save_draft to save current content and completed/remaining work. Reuse the linked project rather than creating another. All slide content must be complete, natural English and actually reviewed. Call preview_slides for ALL slides at the latest saved revision; read each resulting image, fix issues, then re-review affected slides. The harness verifies real preview calls, revision and slide coverage. Save the actual final content and deviation reasons in summary_json (JSON-encoded object), sources_json (JSON-encoded array), project_id, reviewed_slide_ids and reviewed_revision. Do not register a publication or claim the user uploaded it.`}
An interrupted run resumes from saved database context, not from your earlier CLI memory.`;
}
