# First draft production

## Build the draft

Read the confirmed analysis/direction and saved production draft.
If no project is linked, call production_create_project. Otherwise reuse the linked project.
Set the actual topic/message metadata. Mark the first slide as hook and the final CTA slide as cta.

Build a complete hook, body, follow CTA and visual layout using docs/content-guidelines.md.
Apply the guide from the first draft, including image-first composition, essential copy, typography
and the fixed badge. Allocate enough slides to meet those rules.

Reuse the analysis stage's references. Read source documents/images only as needed for the chosen layout.
Use production_import_image to copy a suitable owned asset or a reference image within the authorized source scope.
Never use an unrelated asset or a text-only page to conceal a missing image.
Record missing capabilities/assets honestly and leave the work incomplete if the guide cannot be met.

## Character images

Read [the character rules](character/guidelines.md) before preparing character artwork.
The attached images are provided in this order:

1. [Full-body turnaround](character/turnaround.png): proportions, clothing, skin tone and style.
2. [Face and sunglasses](character/face-sunglasses.png): head shape and sunglasses.
   The turnaround controls skin tone and shading.
3. [Finished example](character/example.png): supporting example of the character, equipment and
   highlighted muscles together. It does not override the two official references or specify
   the pose for other exercises.

These files are under docs/production-prompts/character/.
When a generation tool is available, pass the actual references to it as image inputs as well.
Text filenames alone do not transmit images. Supply an exercise-specific pose/equipment source
when required by the character rules. Do not claim generation succeeded if no tool was available.

Character-source rules govern the generated asset itself. Its placement may extend beyond the
slide under the content guide's crop rule; judge the visible pose in the final slide.

## Check recent overlap and direction changes

Call production_comparisons before saving actual content and again before completion.
It includes retained drafts and posts published within 24 hours. The same topic AND broad content
type is a duplicate; pending ideas do not reserve that combination. The first saved actual content keeps it.
If another task saved overlapping content first, use production_change_direction with cause="collision"
to replace this direction without abandoned-choice history. For a research-driven change, use
cause="research" and record the reason. Recheck overlap after changing direction.

## Review and output

Preview ALL slides at the latest saved revision, inspect the actual images and fix draft issues.
The harness verifies saved revision and full-slide preview coverage.

Return project_id, summary, sources, reviewed_slide_ids and reviewed_revision.
This completes the first draft, not the whole task. Hook and visual review follow separately.
