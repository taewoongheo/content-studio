# First draft production

Read the confirmed analysis and direction, plus your production draft to resume. If no project is
linked call production_create_project (reuses task project after resume). Write hook/body/CTA and
visual layout through editing tools; set actual topic/message metadata. Use production_import_image
to reuse an existing project asset or stored reference slide in an image placement; it imports
through the app and cleans temporary files. Use production_save_draft to save current content and
completed/remaining work. Reuse the linked project rather than creating another. All slide content
must be complete, natural English and actually reviewed. Call preview_slides for ALL slides at the
latest saved revision; read each resulting image, fix issues, then re-review affected slides. The
harness verifies real preview calls, revision and slide coverage. Save the actual final content and
deviation reasons in summary_json (JSON-encoded object), sources (structured array),
project_id, reviewed_slide_ids and reviewed_revision. Do not register a publication or claim the
user uploaded it.


## Character image references

Before preparing character images, read [the character rules](character/guidelines.md).
The three attached images are provided in this order:

1. [Full-body turnaround](character/turnaround.png): body proportions, clothing, skin tone and rendering style.
2. [Face and sunglasses](character/face-sunglasses.png): head shape and sunglasses structure. The turnaround controls skin tone and shading.
3. [Finished exercise example](character/example.png): supporting example of character, equipment and muscle highlighting together. It does not override the two official character references or prescribe a pose for other exercises.

These files are available under docs/production-prompts/character/ in the project.
When an image-generation tool is available, pass the actual reference images to that tool as well;
mentioning filenames in a text prompt is not a substitute for reference-image input.
Provide an exercise-specific pose/equipment source when needed by the character rules.
If generation is unavailable, record the missing capability honestly; do not claim an image was generated.


Complete a usable first draft with hook, body, CTA and visuals. Mark the first slide as hook and the final CTA slide as cta. The next CLI stages review the hook and visual quality separately; this stage does not finish the overall task. Use a follow CTA with a brief reason relevant to the content.
