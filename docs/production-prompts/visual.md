# Visual verification and revision

## Scope

This is the final fixed stage, after hook review. Read production_context and the latest linked project.
Keep the approved hook, body, CTA, topic and factual claims unchanged.
Use the latest content summary from the hook draft or log; do not restore the original production hook.

## Compare actual images

Query relevant published owned posts and user-selected references. Use production_preview_project
or production_read_images to view actual source slide images in this run.
Use preview_slides to view ALL current slides. Compare the images side by side in your reasoning.

Choose appropriate source slides for the current content, not just the same topic. Record their IDs,
which visual features you carry over and where you apply them:
- Heading/body hierarchy, type size and weight.
- Information density, whitespace and alignment.
- Image scale, cropping and balance with text.
- Color emphasis and consistency across slides.

Follow docs/content-guidelines.md and docs/production-prompts/character/guidelines.md where relevant.
Match the chosen visual direction while adapting layout to the current answer. No fixed template is required.

## Revise and finish

Correct layout, visual styles and layer order without changing copy or image identity.
This stage supports update_visual and reorder_layers; content edits, undo, project creation,
metadata changes and replacing images are blocked. Use common/shared styles where appropriate.
Do not hide or crop necessary information to make a slide look clean.
If missing or inaccurate assets prevent a usable result, report the blocker instead of approving it.

Save the visual assessment, chosen references, actual adjustments and any remaining problems to this step's draft.
Review can leave a strong draft unchanged; do not invent edits just to show activity.
After all edits, call preview_slides for ALL slides at the latest saved revision and inspect every result.
Check for clipping, overlap, legibility, image proportions, visual consistency and agreement with the source direction.

Return project_id, summary_json containing the full final content summary, sources_json,
reviewed_slide_ids, reviewed_revision, review (English findings and changes), and review_passed.
Set review_passed=true only when the visual criteria pass. If unresolved problems remain, set it to false
and describe them. The harness only finishes production after this step passes.
