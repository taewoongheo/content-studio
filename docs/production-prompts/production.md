# First draft production

## Implement the direction

Read the confirmed analysis/direction, start request and any saved production draft. Reuse a
linked project on resume. Otherwise call production_clone_project using the internal project
confirmed in analysis.sources.clone_project_id. The clone preserves document, copy and assets.
Reuse what fits; replace subject-specific wording and images as needed. Automatic and past_post
preserve the source composition. External_url and spy_reference deliver the fixed external content
using the nearest internal clone, with extensive changes allowed. Never reconstruct a blank document.

Use 4:5 (1080 × 1350) for every request. Source documents/images are reference evidence;
inspect the confirmed origin only if its saved details are needed. Reuse the
completed analysis instead of repeating topic discovery. Use read_project to inspect the linked
project and edit_project to compose/fill it. Reuse shared element definitions across pages.

Use analysis.reasoning to understand the evidence and tradeoffs behind the choice. The direction's
answer is the substantive commitment, presentation is the working progression and image approach,
and reason explains the choice. Turn them into a content-specific slide plan; do not redo candidate
selection or mechanically transfer every observation into public copy.

Keep the confirmed topic, answer and format within the mode constraints in the start request.
Apply optional additional instructions. Build a complete hook, body and CTA; set slide roles and
save topic/message/content_type. Never use the old source text slots as a reason to omit new
subject-specific facts or retain irrelevant old claims.

Reuse analysis references first. Query other stored references only when needed; do not collect new
posts or import source assets. Facts and practical wording may be verified through web/community
sources within the approved direction. If the premise fails, record the blocker rather than
silently replacing the requested topic.

## Plan and generate slide artwork

This stage owns detailed slide planning as well as implementation. For each slide, decide the
purpose in the overall answer, copy, the role of its one or two images, subject/pose/equipment and
camera/composition. Save slide_plan with production_save_draft BEFORE generating images. Use
actual slide IDs/roles from the linked project and keep the plan in current page order. Each entry
contains purpose, planned copy and visual explanation. While writing the copy, choose the exact
contiguous phrase that communicates this page's key action, distinction, condition or outcome.
Record that phrase and why it matters in the existing visual explanation; do not add public copy
just to create emphasis. Apply the content guide's "페이지별 맥락 강조" rule to EVERY slide,
including hook, body and CTA: render that one phrase in #ED1C24 using textColors/set_text_colors.
Do not merely describe the highlight in the plan: apply it to the actual slide text. Keep the
surrounding text in its role's normal color; do not scatter red ranges or color whole sentences.
Red artwork, decoration and the badge do not satisfy this text-emphasis requirement. Describe how the image makes the message
understandable, beyond saying "exercise illustration". Let adjacent pages connect where the
content needs a sequence; comparison cards or options need not pretend to be sequential steps.
Do not impose recurring explanation fields on every page or add text to make the plan exhaustive.
On resume, read the saved plan and retain completed work. Revise affected plan entries when the
content changes and return the current plan for all final slides. Give each image a distinct information
purpose. Do not reuse one image across placements or rename a previous image. Newly generated
images may have similar poses or compositions; similarity is not a duplicate and must not be rejected.

Retain cloned assets that still accurately explain the new content. Generate only new or
replacement assets with an ACTUAL TRANSPARENT BACKGROUND using the native image_gen
tool in THIS execution, using actual
character references and any needed exercise source. Image generation is enabled only here;
if the native tool fails or is unavailable, save the blocker instead of copying an old asset.
Create the image placement, then call production_use_generated_image with the actual absolute
path returned by the generator. This converts the output to lossless WebP, preserves transparency,
and saves the bytes in this project. White, solid or fake checkerboard backgrounds are rejected;
request native transparency, not a white background matching the slide. The generated-file importer rejects old outputs, arbitrary
paths and project image duplication. Regular set_local_image is blocked in automatic production.
Never use a generated-assets folder as a library. No source folder path remains in the saved project.
Do not delete generator-managed originals. Application-created conversion files are temporary.
On resume, keep already saved images at their existing placements; generate only missing/rejected
images, not every image again. Final visual verification checks rendered artwork.

## Character artwork

Read docs/production-prompts/character/guidelines.md before preparing artwork.
Actual reference images are attached in this order:
1. turnaround.png: full-body proportions, clothing, skin tone and style.
2. face-sunglasses.png: head shape and sunglasses; the turnaround controls skin/shading.
3. example.png: supporting character/equipment/muscle-highlight example, not a prescribed pose.

When new or replacement artwork is needed, use the native image_gen tool with these character references. Retaining suitable cloned artwork requires no generation.
Pass the actual images to it; filenames alone are not image inputs. Add an exercise-specific
pose/equipment source when required by the character guide. Do not claim generation without a tool.
Asset rules govern the image; the content guide governs its placement and permitted cropping.

## Resolve recent overlap

Only automatic requests apply overlap prevention. Explicit requests skip this section.
Call production_comparisons before saving actual content. Use the research
guide's recent topic-and-format rule. If another task overlaps, compare alternatives within the
confirmed internal origin's format and composition. Use
production_change_direction(cause="collision") only for a viable alternative within those constraints.
If all considered alternatives overlap, keep one and record the candidates and acceptance reason
in direction_changes/research. Previously accepted duplicates are allowed to finish; do not restart
selection or repeatedly rewrite content to avoid an unavoidable overlap.

## Save and verify

Before completion, review the saved draft's content through read_project and the approved plan. Save content_review:
- assessment: judge unnecessary repetition, logical jumps, claims/numbers against the evidence
  actually checked, whether the body fulfils the hook promise, and whether images explain the intended content.
- issues: record only actual problems, their slide/location, concrete correction or blocker, and
  status (resolved or blocked). Use [] when there are no actual problems. Do not invent corrections.

Correct real problems within this stage before handing off. Verify facts only for claims/numbers
actually used; narrow or remove unsupported wording. Do not audit for missing explanations or
add background, caveats or extra text for completeness. A failed central premise remains a blocker
under the research guide. Do not report completion with a blocked content issue.
Hook review receives the draft and reasoning for wording choices; English polishing receives the
approved copy; visual review handles wrapping/spacing and checks contextual text emphasis. Do not leave substantive claim or logic
problems for these more narrowly scoped stages to repair.

Save work and the complete current summary. Read the saved document to confirm the planned copy,
exercise prescriptions, roles and intended artwork are present. Return slide_plan and content_review.
Only content errors (claims, logic, relevance or mismatch with the approved answer) block this stage.
Do not inspect or reject badges, emphasis appearance, spacing, clipping, typography or preview rendering.
Those checks belong exclusively to final visual verification. Do not report an application-rendering
blocker from this stage. The plan/review are internal records, not public-facing copy.
