# First draft: implement the selected content

Read the approved answer, presentation, content sequence, conditions and rationale, and the linked document.
Resume the linked document. For internal origins (automatic origin=internal or past_post), clone the confirmed analysis.sources.clone_project_id
with production_clone_project after inspecting that source. Replace the cloned text and images with
the selected content. For these internal origins, preserve the source page count, order,
information roles, element grouping and visual treatment. Replace corresponding copy and images only.
Read analysis.source_format from production_context after cloning: it is the frozen original document,
including original copy, for comparison. An older presentation that requests extra explanation pages does
not override this contract. Reconcile it with the source before implementing; do not recreate the project.
For external origins (including automatic origin=spy), create a blank project with production_create_project and implement the supplied
external-reference contract using the attached source slides. Write in the persona's voice.

Implement the hook and body together using the source-to-new-subject mapping in analysis.presentation.
Preserve what the original hook foregrounds and how its promise is answered by the body; adapt its wording
to the new subject and persona. Keep the subject and intended answer recognizable across the cover and
body. Do not replace the planned framing with a generic benefit or add repeated qualifications to body
pages merely to justify a new hook. Include this relationship in content_review.assessment, checking
the actual cover and body together rather than only whether individual sentences are true.

Save slide_plan before generation with the original slide IDs/order, roles, replacement copy and image roles.
For each purpose, identify the corresponding source page's specific job and how the replacement preserves it
(e.g. an exercise prescription, not merely "body"). Do not add/remove pages or slots or repurpose an exercise
page as commentary. Do not hide an extra explanation inside existing text slots.
Retain images that explain the new content; generate replacements
for subject-specific images using the approved scene/action plan and official character references.
Import generated images into the corresponding placements. Supplementary references help resolve
concrete uncertainty about actions or equipment.

Implement the confirmed substance and sequence. For automatic requests, check production_comparisons and apply the
research guide's overlap rule; explicit requests use their selected material.
Review the actual saved content for accuracy, logic, relevance, text/image agreement and whether the
body delivers the hook. In content_review.assessment, compare the saved draft page by page with the frozen
source, including each page's specific information role. Check against the original, not just your own plan.
For automatic requests, also compare subject and concrete content with the origin: the same list, exercises
and prescriptions with paraphrased copy is a failed variation even if every page matches structurally.
Repair content within the preserved composition; do not copy source substance back to improve visual similarity.
Repair deviations and verify the result. Save metadata, slide_plan,
content_review and the complete current summary. Use issues=[] when no issues remain to report.
