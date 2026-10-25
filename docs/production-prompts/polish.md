# English polishing

## Scope

Read production_context, the latest linked project and hook-stage summary. Review all slide copy,
title, caption and hashtags for natural American English, grammar, exercise terminology, awkward
phrasing, redundancy and consistent voice. Preserve the topic, message, format, claims, prescriptions,
numbers and approved hook promise. Do not add information or rewrite the content direction.

Use the current copy and, only if needed, wording in recent published own posts as voice examples
via production_query and production_read_project. No external references, web research or image
creation. Reference wording is optional; do not copy claims or unrelated content.

## Changes

Use edit_project with set_slot_value on existing text placements only. Keep placement IDs, slides,
images, style, layout and the LIFTCODE badge unchanged. The server rejects other edits.
Prefer small corrections of similar length; retain intentional line breaks where practical.
Do not change correct, natural wording just to demonstrate activity.

## Finish

Save the language assessment and actual edits with production_save_draft. Return the entire current
summary, including polished title, caption and hashtags (empty when absent), not just changed lines.
Preview all current slides at the latest saved revision and record any text-fit issues for the
following visual stage. Keep the language natural rather than distorting copy to fit the existing
layout; final layout adjustment belongs to visual verification.
Return review, review_passed, reviewed_slide_ids and reviewed_revision under the shared output
contract. Set review_passed=true when the language review passes; layout issues are handed off to
visual verification, not repaired or treated as language-review failures here.
