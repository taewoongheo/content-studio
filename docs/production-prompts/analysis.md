# Analysis and direction

## Retrieve the assigned comparisons

The material node selected five random own posts from the configured high-rate candidate pool,
plus the five most recent posts, without overlap. The rate is (likes + comments + saves) / views.
For automatic requests, assigned IDs and selection groups are in this prompt. Retrieve EVERY ID with
production_query(ids=[...]), preferably in small batches. Keyword search cannot replace this pool.
Automatic completion requires all assigned IDs. For past_post inspect only the selected origin;
for external requests retrieve relevant internal layout candidates, not the entire pool.
The recent group contains the absolute newest posts; performance sampling excludes that group.

Own posts include a frozen `performance` array of collected stage metrics: `early` (1 to under
3 days), `middle` (3 to under 7 days), and `late` (7 days onward). Selection still uses the existing
latest-rate pool; interpret performance using these stage records:
- Compare metrics only between matching stages. Do not judge an early result against another
  post's late result or treat an early result as its final outcome.
- When multiple stages exist, use their observed changes as additional evidence. Do not infer
  missing stages, exact day-1/day-3/day-7 results, or daily growth speed; collection times vary
  within each stage, especially late records.
- If the array is empty or absent, use the post's subject, format and expression as context and
  check overlap through the existing tool. Do not use its latest metrics as evidence of success
  or failure. Missing metrics are not zero.

## Choose a subject within the original information roles

Separate three concepts:
- topic: the concrete subject or set of things being explained; this changes for internal variations.
- content_type: the reader's question type, answer method, information roles and progression; retain it.
- visual composition: the positions and expression of those roles; the clone retains it.

A replacement must perform the SAME INFORMATION ROLE in the SAME SLOT, not merely fit its space.
First describe what each original slot does, independent of its subject. Then choose a different
subject whose content can fill those roles unchanged. Retain the kind of reader question, answer,
page sequence and relationship between text and images. Changing only the angle of explanation
about the same subject is not the requested variation. Do not turn an instruction slot into a
selection criterion, condition, evaluation or troubleshooting slot simply because text fits there.
These are information roles, not a fixed taxonomy or domain-specific examples.

Automatic: inspect the assigned internal candidates, select one origin and a distinct subject
that preserves its information roles. Past_post: use only the selected origin and change the subject
under the same rule. External_url/spy_reference: read the selected caption and ALL preserved slides;
keep that subject and substance, and choose the internal origin with the closest information roles.
Explicit external content is not rejected for duplication. Do not reinterpret it as a new topic.
Record exactly one sources.clone_project_id for the inspected internal origin.

In presentation, map new content to existing page/slot roles and explain why those roles still fit.
Reject a proposed internal variation if it requires a different reader task or information role.
State a clear subject and usable content direction for the first draft.

## Verify the content in use

Before finalizing the direction, work through how the intended reader would understand, decide or
act on the proposed content and whether the resulting outcome serves its stated purpose. Check
relevant prerequisites, order and interactions between parts, rather than judging each item alone.
Identify the domain knowledge needed to resolve material uncertainty and verify it through internet
research using the attached research guide. Use the findings to correct the proposed content and
its sequence within the selected information roles.

Hand off a concrete answer and content plan, not just a topic: put the verified substance in answer
and its sequence, applicable conditions and rationale in presentation so the draft can implement it.
Record supporting sources and distinguish verified findings from assumptions. Investigate questions
that affect the decision; no source count or research length is required.

## Check overlap

For automatic requests, call production_comparisons once before finalizing direction and apply the
attached research guide's overlap rule. If every viable candidate overlaps, record why the duplicate is accepted.

## Save the decision

Save analysis and reasoning: influential observed examples, interpretations and meaningful candidate
comparisons. Separate observed performance from causal hypotheses. Do not fill candidate quotas.
Use the metadata guide for topic/message/content_type. answer states the concrete answer;
presentation maps it to inherited information roles; reason explains the selection. Keep these
fields complementary. Return all required direction fields, reasoning and sources. Hand off the decision and its supporting evidence.
