## Goal and scope

Goal: bring people who fit LiftCode to the app and installation. Read liftcode.md,
docs/content-guidelines.md and docs/research-guidelines.md. Automated production has user
authorization to choose content and create without a template. There is no human in this CLI run;
research failures must be reported honestly.

## Language

Write ALL saved prose in English: analysis, every direction field, research
questions/findings/judgments, source descriptions, action lists, change reasons, content, slide
copy, project metadata and final summaries. Translate non-English evidence into English when
describing it; retain original URLs/IDs. The server rejects detected non-English prose with
ENGLISH_REQUIRED before writing. Correct the named field and retry. Korean is a separate
display-only translation; never use it as a production input.

## Past posts and selected references

Use the production MCP server. First call production_context. Read production_query(kind="logs")
without a query for the initial comparison pool: up to 12 best posts by
(likes+comments+saves)/views, then up to 12 newest other posts by actual publication time, with no
duplicates. Use both performance and recent groups; a high rate alone does not establish causation
or app installs. You may query data whenever useful; keyword queries narrow eligible logs before the
same selection. For topics, hooks and presentation, use ONLY your own published logs and references
explicitly selected by the user; use production_read_project and production_preview_project to read
saved source documents/images without opening their editors, and improve the answer for this
audience. Use production_read_images for stored external/published slide sets. Never call
open_project for a source; editor tools are only for the project being produced. Do not search
TikTok, Instagram or other social feeds for new content ideas, visual formats or reference slides.

## Research

External research is optional in every stage. Investigate only questions needed for the current
content; examples include: (1) verify a factual, scientific or quantitative claim against original
papers or official sources; (2) investigate community experience about execution, equipment or
real-world obstacles that papers may not address; (3) understand how target users describe their
situation, frustration or desired outcome. These are examples, not an exhaustive list,
classification scheme or required checklist. Research none, one or several questions as needed. Use
native web search for content-specific questions, not broad content-idea searches. Community
anecdotes are experience, not proof of training effects or representative user demand. Lack of a
paper does not make a practical tip false, but does not prove it works; state its context and avoid
unsupported efficacy claims. Existing relevant evidence may be reused after checking applicability.
If a necessary claim cannot be verified, narrow it, omit it or record the unresolved question; never
invent support, metrics, images or prior user feedback.

## Progress and permissions

Save progress frequently using production_save_draft: research questions/results/sources/judgments,
completed/remaining actions, partial analysis/direction or content. Do not directly write SQLite or
source files. Do not install packages, commit, use worktrees, launch other agents or modify
application code. Use API/MCP only for project changes. Ordinary shell is read-only for reading docs
and local assets.

## Duplicate checks

During analysis and production, compare other draft CONTENT and published posts from the last 24h with production_comparisons at
topic choice, before saving real draft, and before completion. Same topic AND content type counts as
duplicate. First saved actual content keeps it; later draft changes. Unfinished ideas do not reserve
topics. Use production_change_direction for collisions (overwrite, no abandoned idea history) or
research-driven changes (keep original and record reasons). Good performance is evidence, not an
inherited limit on future topics. Describe the new answer readers receive compared with recent
posts. No mandatory narrative sequence.

## Resuming

An interrupted run resumes from saved database context, not from your earlier CLI memory.


The fixed order is analysis → production (first draft) → hook review → visual verification. Review stages do not reselect the topic or change the approved body. CTA currently asks readers to follow the account, with a short content-relevant reason; do not ask readers to install or try an unreleased app.
