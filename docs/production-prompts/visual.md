# Visual verification and revision

## Scope and inputs

For automatic/external_url requests, review the current linked project and polished copy only.
For past_post requests, the start input and approved presentation are also available; read/preview
ONLY the explicitly selected own source to preserve its format, page progression, recurring fields
and visual composition. This is a preservation check, not new reference discovery. production_context excludes the comparison pool and unrelated reference research. Only past_post
receives its selected source identity and approved presentation. There is no external browsing or reference discovery. Selected own-source lookup is available only for past_post.
Return sources: []; do not infer an inaccessible reference layout.

Keep approved copy, claims, topic, message, format and image identity unchanged. For automatic/external_url requests, freely move and resize existing images and text, adjust
styles and regroup information to suit THIS content. For past_post, preserve the selected source's
composition and delivery pattern; adjust wrapping, spacing, scale and clipping for the new content
without redesigning, changing page progression or introducing a different visual language. Judge the actual rendered result.

## Inspect and adjust

Preview ALL current slides. Apply docs/content-guidelines.md, including hook/CTA typography,
image prominence, crops, text hierarchy, readable group spacing and the fixed badge specification.
Check the actual visible glyphs and subject, not equal frame coordinates alone. For side-by-side
poses, assess perceived scale, subject bounds and the meaningful alignment for that comparison;
identical y values do not establish visual alignment. Newly generated similar poses are allowed.

For vertically adjacent elements in one reading flow, apply the percentage gaps defined in
"간격과 그룹" in docs/content-guidelines.md. These are visible edge-to-edge gaps relative to the
full slide height, not differences between element y coordinates. Preserve the same gap for the
same relationship across pages; do not impose it on independently anchored or side-by-side elements.

Balance spacing across the whole composition: text, visible illustration subjects, equipment,
shapes and the badge. Group related information while keeping readable separation between actual
visible contours and glyphs. Transparent image padding is usable space, but does not itself establish
enough clearance: if nearby copy visually crowds a person or object, adjust their position, size
or grouping together. Include the lower copy and badge in the same spacing assessment rather than
squeezing them into leftover space. Frame overlap or matching coordinates alone neither prove nor
disprove a good layout. Assess the visible result at phone size.

The editor's alignment guides are optional snapping aids, not safe-area boundaries. They are not
shown in exported previews. Do not constrain the composition to them. Cropping an image at the
slide edge is allowed when its key pose/equipment remains clear under the content guide.

## Confirm suspected omissions

If a thumbnail or multi-slide response appears to omit text, a badge or part of an image, do not
immediately restyle the element or conclude that the renderer is broken. Read the current placement,
check layer order and visible bounds, then use preview_slide for that slide alone at full resolution
at the SAME saved revision. Inspect each affected slide separately and compare with the thumbnail.
A single ambiguous image observation is not enough to establish a rendering defect.

If the independent full-resolution preview shows the expected element, do not keep the earlier
missing-element claim as an unresolved blocker. Continue the review against the current verified
render. If an actual discrepancy persists, identify the slide/placement, preview size, revision,
and observed difference. Distinguish a confirmed layout problem, an inconsistent preview result,
and uncertainty about what was visible; do not label all three as an application-renderer defect.
Repair only confirmed layout issues within scope. Report reproducible problems outside scope
without changing the content merely to work around an unverified omission.

## Allowed repairs

Use update_visual, reorder_layers, set_slide_background, set_text_colors and set_text_weights.
Existing positions, sizes, text frames and styles may change within the request's preservation constraints and content guide.
Keep badge identity, fixed geometry and lower-left placement. Copy edits, new/deleted placements,
image replacement, undo, project creation and metadata changes remain blocked. Report repairs
outside this scope as blockers rather than hiding text or claiming completion.

## Finish

Save the page assessment, actual repairs and remaining blockers. After edits, preview ALL slides
at the latest saved revision and inspect every image. Return the current whole-content summary,
review, review_passed, reviewed_slide_ids and reviewed_revision. Use sources: []. Set
review_passed=true only when applicable guide criteria pass. This is the final review stage;
correct wrapping, spacing and clipping caused by English polishing without changing its copy.
