# Analysis and direction

## Retrieve the assigned comparisons

The material node selected five random own posts from the configured high-rate candidate pool,
plus the five most recent posts, without overlap. The rate is (likes + comments + saves) / views.
For automatic requests, assigned IDs and selection groups are in this prompt. Retrieve EVERY ID with
production_query(ids=[...]), preferably in small batches. Keyword search cannot replace this pool.
Automatic completion requires all assigned IDs. For past_post inspect only the selected origin;
for external requests retrieve relevant internal layout candidates, not the entire pool.
The recent group contains the absolute newest posts; performance sampling excludes that group.

Own posts include a frozen `performance` array of collected stage metrics: `early` (1 to under
3 days), `middle` (3 to under 7 days), and `late` (7 days onward). Selection still uses the existing
latest-rate pool; interpret performance using these stage records:
- Compare metrics only between matching stages. Do not judge an early result against another
  post's late result or treat an early result as its final outcome.
- When multiple stages exist, use their observed changes as additional evidence. Do not infer
  missing stages, exact day-1/day-3/day-7 results, or daily growth speed; collection times vary
  within each stage, especially late records.
- If the array is empty or absent, use the post's subject, format and expression as context and
  check overlap through the existing tool. Do not use its latest metrics as evidence of success
  or failure. Missing metrics are not zero.

## Select the original before the topic

Read production_context.input. Automatic: select one assigned internal post, inspect its actual
slides, and choose a related new topic fitting its format, progression and visual composition.
Do not query external references for automatic selection. Past_post: use only the explicitly
selected internal origin and choose a related topic within that same composition.
External_url and spy_reference: read the selected caption and ALL preserved slides. Keep the
external topic and content. Select the assigned internal project closest in page structure,
copy density and image roles, inspect it, and use it as the editable clone origin. Always produce;
if the fit is weak, plan larger changes. Reuse useful internal visual elements where possible.
Record exactly ONE sources entry with clone_project_id set to the internal project ID.
Presentation explains the retained structure and required replacements. Never plan blank creation.

Community questions, non-overlap and app-feature fit do not establish TikTok interest.
Factual verification belongs to first-draft production; this stage has no general web search or shell.

For automatic selection, compare origin-plus-variation candidates using actual content and stage
performance under the research guide. Record observations that changed the decision, separating
observed response from inferred causes. For past_post, choose a useful variation of the fixed origin.
For external selections, evaluate internal clone suitability, not alternative external topics or
whether the user's selected content deserves production. No exhaustive performance study is needed.

## Check overlap

Only automatic requests apply this section. Explicit internal and external selections bypass
duplicate prevention entirely. Call production_comparisons once before finalizing direction.
Only retained drafts and posts published within 24 hours participate in duplicate prevention.
The same topic AND similar format is a duplicate; a different topic OR format is a new candidate,
not proof of appeal. Older successful combinations may be reused.
Pending ideas do not reserve a combination; the first saved actual content keeps it.
Adjust candidates only within the request constraints. If every considered alternative overlaps,
select one anyway and record which alternatives were considered and why the duplicate is accepted.
Do not loop indefinitely or change a fixed source format/subject to avoid overlap.
production_change_direction is unavailable in analysis.

## Record the reasoning and hand off the direction

Return a concise synthesis in analysis and the consequential reasoning in reasoning:

- observations: identify influential cases and the actual slide/copy that matters. Explain the
  answer offered, hook promise versus body delivery, and observed metrics where available.
  Describe what was actually inspected before interpreting why it worked. Reading every assigned
  post does not require an equally detailed record for every post; include cases that changed the decision.
- interpretations: connect observations to findings about format/value or delivery. Explain the
  comparison supporting each finding and meaningful counterexamples or limits. Do not treat
  correlation as a proven cause. Use an empty limits string when there is nothing consequential to add.
- candidates: compare genuinely different options within the request constraints, the concrete
  value a viewer would get, and the evidence-backed tradeoff behind selecting or rejecting each.
  Candidate count follows the decision; do not fill a quota, invent weak alternatives or score a rubric.

Keep observations, interpretation and the selected direction consistent without repeating entire
paragraphs between them. Lists may be empty when the available evidence or fixed request leaves
no meaningful comparison; explain consequential limitations in the synthesis rather than inventing evidence.
Use the metadata guide for topic, message and format.
In the additional direction fields,
answer states the actual answer the viewer will receive, beyond the concise message; presentation
explains how the content progresses to that answer and what images contribute. A generic
"problem → solution → CTA" is insufficient: name the problem/comparison, substantive explanation
and intended takeaway for THIS content. This is a flexible production plan, not finished slide copy.
reason connects the chosen direction to the comparisons. These fields are the next stage's
confirmed direction and working plan; the production stage can refine the page flow while
preserving the answer, format and start constraints. Do not repeat the same sentence across these
fields. Explain expected response, goal connection and difference from
recent content. Let the selected content determine its information structure and explanation depth; do not prefer
shorter candidates or apply a fixed information checklist to every body page.
Plan enough slides to meet the content guide and inspect actual references before
claiming a visual direction. For past_post, presentation explains how the new subject fits the
source format; do not select a new visual direction. For external_url and spy_reference, presentation identifies the internal clone and changes needed to deliver the fixed external content. Save sources and research findings; do not create or edit a project.
Do not create an unresolved-claims checklist or a "things to verify" handoff. First-draft
production verifies only the claims/numbers it actually uses. Save reasoning with
production_save_draft along with the direction and relevant sources. Return analysis, reasoning,
the direction fields and structured sources required by the schema.
