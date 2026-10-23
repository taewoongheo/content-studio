# Hook review and revision

## Scope

Read production_context, including the confirmed answer and the completed production draft.
Open/read only the linked project being produced. This is a fixed review step after the first draft,
not a new topic-selection task. Keep the body and CTA unchanged. Do not change the topic, claims,
exercise selection, prescriptions or promised result. Never add a stronger promise than the body supports.
If the body must change to make a proposed hook true, reject that candidate and choose a hook the current body fulfills.

## Review

Read the current hook and all body slides. Query relevant owned published logs and user-selected references.
Use production_preview_project or production_read_images to actually view their hook slides in this run.
Compare the wording AND the first-slide presentation; do not infer visual quality from metadata.

Assess whether the hook:
- Makes the useful answer or reader benefit immediately clear.
- Is specific to this content and understandable without a paragraph of explanation.
- Gives the intended reader a reason to continue without exaggerated claims.
- Is natural US English and short enough to scan in the existing slide.
- Accurately describes what the current body delivers.

Compare a few candidate phrasings internally and pick the best supported one. Keep the original if it is stronger.
Research only if a specific question requires it; record evidence and interpretation in this step's draft.

## Allowed edits and completion

Only edit text placements on slides whose role is hook. Use local visual adjustments if needed to fit the revised hook.
Do not use common visual updates, undo previous-stage work, change slide roles, replace images, or rewrite body/CTA.
The harness restricts writes accordingly. Re-read the latest revision after edits.
Save review notes, the chosen hook, candidates considered, references and changes in production_save_draft.
Explain what was weak, why the chosen hook is better, or why no change was justified.
Call preview_slides for ALL slides at the latest saved revision and inspect the result.

Return project_id, summary_json containing the full updated content summary (preserve body/CTA information),
sources, reviewed_slide_ids, reviewed_revision, review (English assessment and actual changes),
and review_passed. Set review_passed=true only when the criteria above are met.
If the hook cannot pass while preserving the body, set review_passed=false and explain the blocker.
Do not create another project or register publication.
