# Measured layout review

Use inspect_slide_layout on every current slide, and preview the actual slides. The measurement tool uses
the same rendered scene as the editor/export, after fonts and wrapping. Its visible bounds exclude
transparent image padding and shadows. Filled backgrounds/containers count as visible objects; do not
mistake their bounds for their child text. Measurements alone do not establish good composition.

Before editing, identify the reading groups and relationships: headings with their supporting labels,
dividers with their adjacent information, explanatory copy, callouts and subject illustrations.
Preserve source page roles, grouping and columns; correct inconsistent visible spacing within them.
Use the same gap band for the same relationship across repeated pages, unless the meaning/layout differs.
Do not give every neighboring object the same gap: within-group and between-group spacing have different jobs.
A divider may be intentionally closer to one group, but apply that relationship consistently.

Measure gaps from visible edges, not frame y values. Fixed-height, vertically centered text frames shift
visible edges when font or line count changes. Fit text frames to the content and position related objects
from measured edges. Move a related group together when needed; keep the original composition and fonts.
For callouts, check the gap before the container separately from its internal text padding. Do not solve
spacing by dropping content, shrinking below 35px at 1080px width, or adding/removing pages or slots.
Also measure the outer clearance of the final text/callout group against the slide edge. Avoid merely
fitting it without clipping: retain at least one body line-height of breathing room, and preserve larger
existing margins where feasible. Deliberately bleeding artwork is a different case. If sequential gaps
consume that space, rebalance earlier group positions consistently across repeated pages instead of
crushing callout padding. Include the final edge clearance in the review explanation.

The manual free-layout guide's 10% title-to-title, 7% title-to-body and 10% text-to-image values refer to
slide-height and consecutive elements in one reading flow. Do not impose them on each nested label,
side-by-side column or preserved dense source layout. Establish the applicable relationship first.

Record intended min/max pixel gaps and reasons BEFORE repairs in production_save_draft.review.
For repeated body layouts, cover the meaningful chain of adjacent groups, including dividers and
callouts when present; do not cherry-pick a single easy pair. Use compact justified bands. Keep the
chosen targets through repairs; never widen a range just to make the current coordinates pass.
After repairs, remeasure and preview ALL slides at the final revision. Return layout_checks with
slide_id, from_id/to_id (placement IDs), axis x/y, min_gap, max_gap and reason. Use the same direction
as reading order; the server calculates the actual gap and rejects out-of-range checks. Body pages
with multiple visible text elements require checks. Intentional overlapping/contained elements are
not sequential-gap pairs; assess those visually and explain the grouping in review.

Compare the before/after result for optical balance and reading order as well as measured gaps.
A numerically passing result may still need another repair. Call production_validate_completion only
when the saved geometry satisfies both the recorded relationships and full-slide visual review.
