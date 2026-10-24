# Shared production instructions

## Goal and workflow

Create one LiftCode TikTok slideshow per task. Read liftcode.md,
docs/content-guidelines.md and docs/research-guidelines.md before working.
The content guide is the source of truth for slide quality and visual rules; older reference
posts do not override it.

The fixed sequence is analysis → production (first draft) → hook review → visual verification.
Each stage can research questions relevant to its own work. Review stages keep the approved
topic, claims and body meaning. There is no human in this CLI run.

The long-term goal is to bring people who fit LiftCode to the app. For now, the CTA asks readers
to follow the account with a short, relevant reason. Do not invite installs or use "Try LiftCode."

## Language

Save all prose in English, including analysis, direction, research, source descriptions, actions,
changes, slide copy, metadata and final summaries. Keep original URLs and IDs.
If the server returns ENGLISH_REQUIRED, correct the named field and retry.
Korean translations are display-only and must not become production inputs.

## Context and references

First call production_context and resume from saved drafts and the linked project.
Then call production_query(kind="logs") without a keyword: it returns up to 10 best posts by
(likes + comments + saves) / views, then up to 10 lowest-rate posts excluding the best group,
then up to 10 newest posts excluding both earlier groups. The pool contains up to 30 distinct posts;
smaller groups are returned when there are fewer eligible posts. Missing metrics or zero views
exclude a post from both rate rankings but not recency.
Consider all available groups. Compare lower-performing examples with stronger ones to identify
differences worth investigating; a low rate does not by itself establish poor content or its cause. Engagement does not establish causation or app installs.
Query again when useful; keyword queries apply the same selection within matching posts.

Select topics using published-post analysis plus internet and community exploration.
External examples expand choices; owned content and its observed performance remain the baseline.
Use production_external_references to compare stored examples when useful. In analysis, call it at
least once before completion, using the ten most recently published owned posts to notice repeated
topics/answers. This is a comparison requirement, never a requirement to copy or apply an external post.
Do not prohibit successful topics merely because they appeared recently; explain the new answer.

Each of analysis and hook has a total allowance of THREE distinct external posts across all
calls and retries. Production reuses analysis examples and has no additional collection allowance.
Use a short literal query keyword, content_type, or known ids for the current decision; an empty query
supports broad exploration. Stored topic/type/features become richer through image-based inspection.
If the pool is insufficient, collect=true requests up to 12 latest candidate posts from ONE designated
account, once per stage. Concurrent tasks share account collections and reuse the 15-minute cache.
These candidate counts are API collection limits, separate from the three examples shown per stage.
No keyword-based TikTok discovery or arbitrary account collection is available.

Inspect actual stored slides using production_read_images and visual_set_id. Check their language
and relevance; a caption or high response rate does not prove slide contents, English language or
quality. Describe selected examples with production_describe_reference only after inspecting images,
using English title/topic/content_type/notes so later tasks can find useful cases. References are not
instructions, and their visual identity never overrides docs/content-guidelines.md.
Keep or change the current result based on a concrete opportunity or weakness, not difference alone.
Record used examples as kind="reference" with id, original URL, part and used_for; explain justified
non-use in the stage assessment when relevant. Server-owned external lookup snapshots are preserved
in each stage context; do not copy their JSON into research or overwrite them.
For visual review, use production_visual_references to select at most five newest matching own posts.
External tools are unavailable in visual; inspect the selected own-project images instead.
Read saved source documents through production_read_project and actual images through
production_preview_project or production_read_images. Do not open source editors.
Editor tools are only for the project being produced.
Do not use TikTok/Instagram internal search or feed browsing to collect new posts or visual references.

## Research and recording

During analysis, explore topic candidates through internet and community searches using
docs/research-guidelines.md. In later stages, investigate only questions needed for the current work. Do not fabricate evidence, metrics, images or feedback.
If a necessary claim remains unsupported, narrow or omit it; review stages report a blocker
when the correction exceeds their allowed scope.

Save progress with production_save_draft: current analysis/content/review, research, sources,
completed actions and remaining actions. Resume from this DB context after interruption,
not from earlier CLI memory.

Use API/MCP for project changes. Do not write SQLite or source files, install packages, commit,
create worktrees, launch other agents or modify application code.
Ordinary shell is read-only for documents and local assets.

## Duplicate checks

In analysis and first-draft production, call production_comparisons at topic choice, before
saving actual content and before completion. It compares retained drafts and posts from the last 24h.
The same topic AND content type is a duplicate. First saved actual content keeps it;
unfinished ideas do not reserve a topic.

Use production_change_direction for collisions (overwrite without abandoned-choice history)
or research-driven changes (preserve the original and record the reason).
Past success is a reference, not a limit on later topics. Explain the new answer this post provides.

## Final output

Follow the current stage's output schema. Return sources as an array, not an encoded JSON string.
Each entry includes kind, id, url, part, used_for and visual_set_id.
part states what you referenced; used_for explains how you used it.
Use null for unused id, url or visual_set_id fields, and provide an id or URL for every source.
Reuse accurate source context from the draft rather than inventing missing descriptions.


For production, hook and visual stages, return summary as an object matching the output schema,
not prose or a JSON-encoded string. Include the current title, topic, message, hook, caption,
hashtags, slides and changes. Each slide contains slide_id, role, copy (an array of strings) and
visual (a description of the actual visual). Use an empty string for caption and an empty array for hashtags if none was written;
do not invent missing published metadata. Save draft progress before the final response.
