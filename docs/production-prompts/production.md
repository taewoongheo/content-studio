# First draft production

## Implement the direction

Read the confirmed analysis/direction and any saved production draft. Reuse a linked project;
otherwise call production_create_project. Keep the confirmed topic, answer and format.
Build a complete hook, body, short follow CTA and visual layout under the content guide from the
first draft. Set slide roles and verify topic/message/content_type under the metadata guide.

Reuse analysis references first. Query other stored references only when needed. Source documents
and images support the chosen content; do not collect new posts. Do not import source assets into the new post. References inform decisions, not reusable artwork.
Never conceal a missing image with unrelated assets or text-only pages.

Facts, practical wording and realistic situations may be checked through web/community sources
within the approved direction. Apply the research guide; a discussion does not establish TikTok
demand. If the premise fails, record the blocker rather than choose a replacement topic.

## Plan and generate slide artwork

This stage owns detailed slide planning as well as implementation. For each slide, decide the
copy, the role of its one or two images, subject/pose/equipment and camera/composition. Save this
plan in the production draft content before generating. Give each image a distinct information
purpose. Do not reuse one image across placements or rename a previous image. Newly generated
images may have similar poses or compositions; similarity is not a duplicate and must not be rejected.

Generate every required asset with the native image_gen tool in THIS execution, using actual
character references and any needed exercise source. Image generation is enabled only here;
if the native tool fails or is unavailable, save the blocker instead of copying an old asset.
Create the image placement, then call production_use_generated_image with the actual absolute
path returned by the generator. This converts the output to lossless WebP, preserves transparency,
and saves the bytes in this project. The generated-file importer rejects old outputs, arbitrary
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
guide's 24-hour topic-and-format rule. If another task saved overlapping content first, call
production_change_direction(cause="collision"), then recheck. Do not preserve abandoned-choice history.
This collision repair is the only permitted replacement of the confirmed direction.

## Save and verify

Save work and the complete current summary. Preview ALL slides at the latest saved revision,
inspect the actual images and fix issues within this stage. The harness checks revision and
full-slide preview coverage. Return the required production result.
This completes the first draft; hook review, English polishing and visual review follow.
