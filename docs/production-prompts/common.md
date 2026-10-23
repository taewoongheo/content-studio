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
Then call production_query(kind="logs") without a keyword: it returns up to 12 best posts by
(likes + comments + saves) / views, then up to 12 lowest-rate posts excluding the best group,
then up to 12 newest posts excluding both earlier groups. The pool contains up to 36 distinct posts;
smaller groups are returned when there are fewer eligible posts. Missing metrics or zero views
exclude a post from both rate rankings but not recency.
Consider all available groups. Compare lower-performing examples with stronger ones to identify
differences worth investigating; a low rate does not by itself establish poor content or its cause. Engagement does not establish causation or app installs.
Query again when useful; keyword queries apply the same selection within matching posts.

Use owned published posts and user-selected references for topics, hooks and presentation.
Read saved source documents through production_read_project and actual images through
production_preview_project or production_read_images. Do not open source editors.
Editor tools are only for the project being produced.
Do not search TikTok, Instagram or other social feeds for new ideas, formats or reference slides.

## Research and recording

Use docs/research-guidelines.md to investigate questions needed for this content.
Research is optional, not a checklist. Do not fabricate evidence, metrics, images or feedback.
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
