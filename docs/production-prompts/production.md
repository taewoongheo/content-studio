# First draft production

## Implement the direction

Read the confirmed analysis/direction, start request and any saved production draft. Reuse a
linked project on resume. Otherwise initialize it according to the request:

- automatic / external_url: call production_create_project with the planned slide count. Start
  with a blank 4:5 document. Evaluate assigned own posts collectively for visual language,
  information hierarchy and composition; synthesize a layout appropriate to THIS content. No
  exact past layout or single source clone is required.
- past_post: read and preview the explicitly selected source from production_context.input,
  then call production_clone_project with that sourceProjectId. It need not belong to the assigned
  comparison pool. The clone preserves saved structure, shared elements, styles and badge but
  clears source copy/images and copies no source image bytes. Keep the format, hook approach,
  page progression, recurring information fields and visual composition. Replace subject-specific
  copy and generate new artwork; fit the content with small readability adjustments, not a redesign.

Use 4:5 (1080 × 1350) for every request. Source documents/images are reference evidence;
query assigned IDs with production_query and preview the cases you actually compare. Reuse the
completed analysis instead of repeating topic discovery. Use read_project to inspect the linked
project and edit_project to compose/fill it. Reuse shared element definitions across pages.

Keep the confirmed topic, answer and format, with the start request's fixed constraints. External
URL requests keep their source SUBJECT but use our character, typography, product facts and writing
style. Past-post requests keep their source FORMAT and presentation, with new subject/content.
Apply optional additional instructions. Build a complete hook, body and CTA; set slide roles and
save topic/message/content_type. Never use the old source text slots as a reason to omit new
subject-specific facts or retain irrelevant old claims.

Reuse analysis references first. Query other stored references only when needed; do not collect new
posts or import source assets. Facts and practical wording may be verified through web/community
sources within the approved direction. If the premise fails, record the blocker rather than
silently replacing the requested topic.

## Plan and generate slide artwork

This stage owns detailed slide planning as well as implementation. For each slide, decide the
copy, the role of its one or two images, subject/pose/equipment and camera/composition. Save this
plan in the production draft content before generating. Give each image a distinct information
purpose. Do not reuse one image across placements or rename a previous image. Newly generated
images may have similar poses or compositions; similarity is not a duplicate and must not be rejected.

Generate every required asset with an ACTUAL TRANSPARENT BACKGROUND using the native image_gen
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
images, not every image again. Final preview checks every slide's one-or-two-image plan.

## Character artwork

Read docs/production-prompts/character/guidelines.md before preparing artwork.
Actual reference images are attached in this order:
1. turnaround.png: full-body proportions, clothing, skin tone and style.
2. face-sunglasses.png: head shape and sunglasses; the turnaround controls skin/shading.
3. example.png: supporting character/equipment/muscle-highlight example, not a prescribed pose.

These files are under docs/production-prompts/character/. Use the native image_gen tool, not a conditional instruction to skip generation.
Pass the actual images to it; filenames alone are not image inputs. Add an exercise-specific
pose/equipment source when required by the character guide. Do not claim generation without a tool.
Asset rules govern the image; the content guide governs its placement and permitted cropping.

## Resolve recent overlap

Call production_comparisons before saving actual content and before completion. Use the research
guide's recent topic-and-format rule. If another task overlaps, compare alternatives within the
request's fixed constraints: past_post keeps format; external_url keeps subject. Use
production_change_direction(cause="collision") only for a viable alternative within those constraints.
If all considered alternatives overlap, keep one and record the candidates and acceptance reason
in direction_changes/research. Previously accepted duplicates are allowed to finish; do not restart
selection or repeatedly rewrite content to avoid an unavoidable overlap.

## Save and verify

Save work and the complete current summary. Preview ALL slides at the latest saved revision,
inspect the actual images and fix issues within this stage. The harness checks revision and
full-slide preview coverage. Return the required production result.
This completes the first draft; hook review, English polishing and visual review follow.
