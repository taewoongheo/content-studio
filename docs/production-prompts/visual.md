# Visual verification and revision

## Scope

This is the final fixed stage after hook review.
Read the latest linked project after production_context.
Use the hook draft or log's latest summary; do not restore the original production hook.
Keep approved wording, claims, topic and image identity unchanged.

## Inspect actual slides

Read the visual rules in docs/content-guidelines.md and use them as the pass criteria.
Call production_visual_references with short subject-specific keywords and synonyms from the approved topic.
Use precise subject phrases (for example add weight / double progression), not generic words like weight or reps alone.
It searches stored own-post titles, topics and messages and returns at most five matching posts,
ordered by actual publication time. This is text matching, not automatic semantic or image search.
If no posts match, refine the keywords. The first nonempty selection is fixed for this execution.
Use those internal posts only; external reference tools are unavailable in this stage.
Read actual images from EVERY selected source project with production_preview_project in THIS execution;
checks from earlier stages or earlier runs do not count.
Inspect ALL current slides with preview_slides.
Within the fixed selection, assess which visual features suit the current answer and layout.
Inspection of every selected project is required, but copying any feature is optional.
Record which visual features you reuse and where. Older posts never override the current rules.

Check every slide against the guide's visual rules: meaningful images, image-first composition,
readable text and hierarchy, approved fonts, the fixed badge, spacing, contrast and consistency.
Use the guide's actual thresholds; do not substitute older posts' styling.
Judge the exported slide boundary. An intentional crop is allowed only when the necessary pose,
movement cues and equipment relationship remain clear.

## Correct within scope

Use update_visual, reorder_layers, set_slide_background, set_text_colors and set_text_weights
to correct layout, styles and hierarchy. Preserve badge wording/color/location and keep its
geometry and margins consistent across pages.

Copy edits, adding/removing placements, replacing images, undo, project creation and metadata
changes are blocked. If unnecessary auxiliary copy must be deleted or an image is missing,
record the specific blocker and fail review. Do not hide copy off-slide, under an image,
at tiny size or in the background color to bypass the restriction.
Keep essential exercise names, sets/reps and decision conditions visible.

## Record and finish

Save the assessment, references, actual adjustments and unresolved issues to this draft.
An already strong draft may pass unchanged.
After edits, preview ALL slides at the latest saved revision and inspect every result.

Return project_id, summary (the complete final summary), sources, reviewed_slide_ids,
reviewed_revision, review and review_passed.
review records the English findings and changes.
Set review_passed=true only when all applicable criteria pass; otherwise describe what prevents
completion. The harness only finishes the task after this stage passes.
