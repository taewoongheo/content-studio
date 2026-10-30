# Visual verification and revision

## Scope and inputs

Review the linked project and approved copy and presentation. Automatic and past_post preserve
the confirmed internal origin's format and composition. External_url and spy_reference may
substantially alter their internal clone to deliver the selected external content; do not restore
the internal layout merely because it differs. No external reference discovery is needed.
Keep approved wording, claims, topic, message and image identity. Repair concrete readability,
clipping, overlap and spacing defects. Avoid discretionary redesign of an already readable clone.

## Inspect and adjust

Preview ALL current slides. Apply docs/content-guidelines.md to actual visible defects:
clipping, overlap, unreadable copy, misleading crops, inconsistent spacing and incorrect emphasis.
Repair missing or displaced contextual text emphasis without changing approved wording.
Preserve readable inherited composition; do not normalize every page's spacing or centering just
to make a change. Judge visible glyphs and image subjects at phone size, not frame coordinates.
The guide owns typography, colors, gaps, group placement and badge specifications.

## Confirm suspected omissions

If a thumbnail or multi-slide response appears to omit text, a badge or part of an image, do not
immediately restyle the element or conclude that the renderer is broken. Read the current placement,
check layer order and visible bounds, then use preview_slide for that slide alone at full resolution
at the SAME saved revision. Inspect each affected slide separately and compare with the thumbnail.
A single ambiguous image observation is not enough to establish a rendering defect.
Before declaring a small element missing, call preview_slide with a region around its saved bounds
and surrounding space. For the lower-left badge, use region {x:0,y:0.90,width:0.35,height:0.10}.
This enlarges pixels from the SAME full-slide PNG, not a reconstruction from the document.
Whole-slide image interpretation can miss small edge details even when their pixels are present.
If the region shows the element, withdraw the omission claim. A region preview supplements, but
never replaces, the required whole-slide review. Do not repeat whole-slide previews as the only
confirmation of a small-element omission.

If full-resolution inspection shows the expected element, withdraw the omission claim and continue.
Repair confirmed defects only; report reproducible problems outside scope as blockers.

## Allowed repairs

Use update_visual, reorder_layers, set_slide_background, set_text_colors and set_text_weights.
Existing positions, sizes, text frames and styles may change within the request's preservation constraints and content guide.
The approved badge specification is immutable, not a malformed draft's current badge.
Its exact two-element specification is in "LIFTCODE 뱃지 — 불변 사양" in docs/content-guidelines.md.
If a badge is missing or differs from that specification (including a combined text/background,
wrong frame/style, local overrides or layer order), call production_repair_badge with the latest
expectedRevision and expectedTabId. It restores the exact approved shared background and label
on all slides through the normal saved, undoable edit path. Do not reject a draft just because
its badge needs this repair. Re-read the document and preview ALL slides at the new revision.
Arbitrary badge edits remain blocked. Move surrounding content to resolve crowding; never move
the badge away from its approved position. Except for this canonical repair, copy edits, new/deleted placements,
image replacement, undo, project creation and metadata changes remain blocked. Report repairs
outside this scope as blockers rather than hiding text or claiming completion.

## Finish

Save the page assessment, actual repairs and remaining blockers. After edits, preview ALL slides
at the latest saved revision and inspect every image. Return the current whole-content summary,
review, review_passed, reviewed_slide_ids and reviewed_revision. Use sources: []. Set
review_passed=true only when applicable guide criteria pass. This is the final review stage;
correct wrapping, spacing and clipping caused by English polishing without changing its copy.
