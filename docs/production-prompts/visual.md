# Visual verification and revision

## Scope

This is the final fixed stage after hook review.
Read production_context and the latest linked project.
Use the hook draft or log's latest summary; do not restore the original production hook.
Keep approved wording, claims, topic and image identity unchanged.

## Inspect actual slides

Read the visual rules in docs/content-guidelines.md and use them as the pass criteria.
Query relevant owned posts and user-selected references. View actual source images using
production_preview_project or production_read_images, and ALL current slides with preview_slides.
Choose references for the answer and layout being delivered, not only for topic similarity.
Record which visual features you reuse and where. Older posts never override the current rules.

Check every slide against the guide:
- One to three meaningful images, with image-first composition.
- Essential action/pose remains clear inside the final slide boundary.
  Intentional image overflow is allowed; do not shrink an image just to contain its entire frame.
- Text meets the minimum size, headings are clearly larger, and body pages use Inter only.
  Oswald is allowed only on hook/CTA pages.
- Only essential copy remains, grouped with consistent hierarchy, spacing and alignment.
- The fixed black LIFTCODE badge is visible at the bottom left on every slide.
- Text is legible and unclipped; image proportions, contrast and page-to-page consistency hold.

Judge the exported slide area, not the editor's off-slide workspace.
Do not flag an intentional crop as a defect when the key pose remains clear.
Do flag cropping that removes necessary movement cues or equipment relationships.

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

Return project_id, summary_json (the complete final summary), sources, reviewed_slide_ids,
reviewed_revision, review and review_passed.
review records the English findings and changes.
Set review_passed=true only when all applicable criteria pass; otherwise describe what prevents
completion. The harness only finishes the task after this stage passes.
