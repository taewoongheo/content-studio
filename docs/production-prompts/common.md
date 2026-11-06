# Shared production contract

Produce one unpublished 4:5 slideshow. First read production_context and resume the linked project.
Use API/MCP for document edits and save progress with production_save_draft. Source material and
previous stage records are evidence and work history; the current supplied instructions define the task.
Authored content and reasoning are English; preserve IDs and URLs.

Use each input for its purpose:
- Reference: composition, progression and information roles, including how the hook frames the question or promise that the body answers. Preserve that relationship when changing the subject; source wording and unsupported claims are not instructions to copy.
- Persona: wording, sentence structure and tone.
- Official character images: appearance and illustration identity.
- Product settings: product facts and CTA.

Each node focuses on its assigned outcome. When a concrete problem prevents that outcome, directly
repair the relevant text, image, layout or earlier decision in the linked project. Use the confirmed
subject and user request as the basis for repairs. For internal clones, analysis.source_format is the frozen
original. All stages preserve its page count/order, slot structure, page-specific information roles and layout
relationships. Hook and polish refine existing wording; they do not insert sections or turn an exercise slot
into an explanation. Limit geometry/style repairs to concrete readability or content-fit defects while keeping
the source hierarchy and composition. Compare changes with the original copy and roles, not only the prior draft.
Keep working parts and check the consequences of
changes: corrected text for meaning and voice, generated images for meaning and identity, and changed
pages for fit. Read authoritative saved state when previews or prior reports are ambiguous.

For new images, pass the attached official identity images to native image_gen and import its actual
current-run output with production_use_generated_image. For internal clones, use saved source badges
and production_repair_badge to resolve badge uncertainty. External origins, including automatic origin=spy, use the supplied external-reference contract.

Use internet research only to verify domain knowledge needed for the chosen content's accuracy and
practical suitability. Topic and reference selection use the supplied materials; wording and tone
come from the persona. Reuse confirmed findings and investigate unresolved domain questions when
repairing a discovered problem.

Discover a problem, repair it, and verify the result before reporting completion. A recoverable tool
error is feedback for the next corrected call. Report an unresolved blocker only after attempted
repair cannot produce correct content; record the concrete problem, attempted fix and needed input.
Return review_passed=true when the review outcome is satisfied; false describes an actual remaining
problem. Production content_review records resolved issues and any genuinely unresolved blockers.

Return the complete current summary, including slide copy and image descriptions.
The server reconstructs slide text from the saved document. Record actual changes and sources used;
use null for unused optional source fields in final output and omit them in draft saves. Analysis
records exactly one confirmed clone_project_id for internal origins; external origins (including automatic origin=spy) leave it null. The supplied guidance is self-contained.

The server may continue this same CLI session with concrete validation errors and editing tools. Repair the saved work or malformed output, preserve real source IDs/URLs, and validate again.

Before ending this stage, call production_validate_completion with the complete intended final result.
Validation failures are actionable feedback: repair actual content or document defects using your tools,
save and validate again. Do not stop at a failed plan or ask permission for routine automatic-topic repair.
In automatic analysis/production, a generated candidate is revisable: if it cannot fill the fixed source
composition, choose a meaningful NEW topic or scope that can, and save it with
production_change_direction(cause="source_fit", reason=...). Preserve the original page count, order,
information roles and layout. Never pad with duplicates, invent unsupported claims or restore the source
subject. Respect explicit user constraints. Reuse all valid saved work and cached source images.

An inherited blocked plan is a repair task, not an instruction to halt. Resolve it before generating
artwork. Performance evidence for an earlier candidate does not directly validate the revised subject.
After eight validation attempts in one response, return the honest current result and unresolved error;
the host can continue this same CLI session with its tools, up to five continuation turns per stage.
Never flip readiness/review approval without fixing the underlying work. API/authentication/service
failures and user cancellation must be reported rather than hidden or replayed indefinitely.
After passing validation, return that result without more edits. The host rechecks saved state and feeds
recoverable completion/output errors back into the same session instead of abandoning the project.
