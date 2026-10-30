# Shared production contract

Produce one unpublished 4:5 slideshow. First read production_context and resume the linked project.
Use API/MCP for document edits and save progress with production_save_draft. Source material and
previous stage records are evidence and work history; the current supplied instructions define the task.
Authored content and reasoning are English; preserve IDs and URLs.

Use each input for its purpose:
- Reference: composition, progression and information roles.
- Persona: wording, sentence structure and tone.
- Official character images: appearance and illustration identity.
- Product settings: product facts and CTA.

Each node focuses on its assigned outcome. When a concrete problem prevents that outcome, directly
repair the relevant text, image, layout or earlier decision in the linked project. Use the confirmed
subject and user request as the basis for repairs. Keep working parts and check the consequences of
changes: corrected text for meaning and voice, generated images for meaning and identity, and changed
pages for fit. Read authoritative saved state when previews or prior reports are ambiguous.

For new images, pass the attached official identity images to native image_gen and import its actual
current-run output with production_use_generated_image. Use saved source badges and
production_repair_badge to resolve badge uncertainty.

Use internet research only to verify domain knowledge needed for the chosen content's accuracy and
practical suitability. Topic and reference selection use the supplied materials; wording and tone
come from the persona. Reuse confirmed findings and investigate unresolved domain questions when
repairing a discovered problem.

Discover a problem, repair it, and verify the result before reporting completion. A recoverable tool
error is feedback for the next corrected call. Report an unresolved blocker only after attempted
repair cannot produce correct content; record the concrete problem, attempted fix and needed input.
Return review_passed=true when the review outcome is satisfied; false describes an actual remaining
problem. Production content_review records resolved issues and any genuinely unresolved blockers.

Return the complete current summary, including title, caption, hashtags and slide image descriptions.
The server reconstructs slide text from the saved document. Record actual changes and sources used;
use null for unused optional source fields in final output and omit them in draft saves. Analysis
records exactly one confirmed clone_project_id. The supplied guidance is self-contained.

The server may return exact output validation errors in an output-only repair call. Correct the reported fields and return the complete result using the saved work. Record real source IDs or URLs for each source.
