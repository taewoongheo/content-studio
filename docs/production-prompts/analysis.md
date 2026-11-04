# Analysis and direction

## Retrieve the assigned comparisons

The material node selected five random own posts from the configured high-rate candidate pool,
plus the five most recent posts, without overlap. The rate is (likes + comments + saves) / views.
Automatic inputs also include direct and related own-post matches for the assigned topic, including matches
outside that comparison sample. Read those IDs too; they carry the topic-specific evidence.
For automatic requests, assigned IDs and selection groups are in this prompt. Retrieve EVERY ID with
production_query(ids=[...]), preferably in small batches. Keyword search cannot replace this pool.
Automatic completion requires all assigned IDs. For past_post inspect only the selected origin;
for external requests inspect the selected external source; no internal layout selection is needed.
The recent group contains the absolute newest posts; performance sampling excludes that group.

Own posts include a frozen `performance` array of collected stage metrics: `early` (1 to under
3 days), `middle` (3 to under 7 days), `late` (7 to under 21 days), and `long_term` (21 days onward).
Selection still uses the existing latest-rate pool; interpret performance using these stage records:
- Compare metrics only between matching stages. Do not judge an early result against another
  post's late result or treat an early result as its final outcome.
- When multiple stages exist, use their observed changes as additional evidence. Do not infer
  missing stages, exact day-1/day-3/day-7/day-21 results, or daily growth speed; collection times vary
  within each stage, especially long-term records. Later-stage growth can reveal delayed response;
  distinguish that observation from hypotheses about its cause.
- If the array is empty or absent, use the post's subject, format and expression as context and
  check overlap through the existing tool. Do not use its latest metrics as evidence of success
  or failure. Missing metrics are not zero.

## Resolve the assigned topic

Automatic requests receive a cached topic candidate with its reader question, intended answer method,
direct own-post matches, related matches and evidence classification. Keep the candidate's question and
substance while verifying the answer. Read the assigned own-post evidence; a related post is not direct
validation, and no direct history means untried, not poor performance. The server's evidence classification
is an operational screen, not causal proof. Do not turn a comparison, explanation, correction or planning
question into an executable routine merely because a familiar source is convenient.
Explain whether this is an exploration or a repeatedly supported topic and the actual evidence or fallback.
The supplied selection baseline covers all eligible own posts at that observation stage. A median calculated
from the smaller assigned comparison sample describes that sample; do not substitute it for the selection baseline.

Past_post uses only the user-selected origin and varies its subject. External_url/spy_reference uses the
selected caption and ALL preserved slides; keep that subject and verified substance and follow the supplied
external-reference contract. Explicit sources are not rejected for duplication.

## Plan the presentation after choosing the content

For automatic requests, select and inspect ONE assigned internal project as the visual starting point.
Keep useful visual identity and source badges, but change page count, information roles, text/image groupings
and sequence when the chosen answer needs it. Explain retained and changed parts in presentation. The cloned
layout must serve the topic; do not downgrade a worthwhile question because a source is awkward to adapt.

For past_post variations, a replacement must perform the SAME INFORMATION ROLE in the SAME SLOT.
Describe the original information roles and map a different subject to them, retaining the reader question,
answer method and page progression. Changing only the angle of explanation about the same subject is not
that mode's requested variation. Do not force a different reader task into the same slot.

For internal modes, record exactly one sources.clone_project_id for the inspected internal origin.
External modes have no clone origin. Keep topic (subject), content_type (reader question and answer method)
and presentation (actual page structure and visuals) distinct. Record why the content is useful separately
from how it will be implemented.

## Verify the content in use

Before finalizing the direction, work through how the intended reader would understand, decide or
act on the proposed content and whether the resulting outcome serves its stated purpose. Check
relevant prerequisites, order and interactions between parts, rather than judging each item alone.
Identify the domain knowledge needed to resolve material uncertainty and verify it through internet
research using the attached research guide. Use the findings to correct the proposed content and
its sequence for the selected reader question.

Hand off a concrete answer and content plan, not just a topic: put the verified substance in answer
and its sequence, applicable conditions and rationale in presentation so the draft can implement it.
Record supporting sources and distinguish verified findings from assumptions. Investigate questions
that affect the decision; no source count or research length is required.

## Check overlap

For automatic requests, call production_comparisons once before finalizing direction and apply the
attached research guide's overlap rule. If every viable candidate overlaps, record why the duplicate is accepted.
If overlap requires a different topic, explain the departure from the initial assignment and reassess its own-post
evidence. Do not transfer the original candidate's proven status to an unrelated replacement.

## Save the decision

Save analysis and reasoning: influential observed examples, interpretations and meaningful candidate
comparisons. Separate observed performance from causal hypotheses. Do not fill candidate quotas.
Use the metadata guide for topic/message/content_type. answer states the concrete answer;
presentation maps it to the planned pages; reason explains the selection. Keep these
fields complementary. Return all required direction fields, reasoning and sources. Hand off the decision and its supporting evidence.
