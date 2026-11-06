# Analysis and direction

## Retrieve the assigned comparisons

Automatic inputs contain only own posts directly or indirectly matched to the assigned spy-pool topic.
There is no separate high-rate or recent-post sample. Retrieve EVERY supplied ID with production_query(ids=[...]);
an empty list requires no own-post query. Direct matches provide performance evidence and possible internal origins.
Related matches provide context only: do not use them to claim proven performance or as a clone origin.
For past_post inspect only the selected origin. For an external origin (including automatic origin=spy), inspect
the selected caption and ALL preserved slides with production_read_images. Do not search for an internal template.

Own posts include a frozen `performance` array of collected stage metrics: `early` (1 to under
3 days), `middle` (3 to under 7 days), `late` (7 to under 21 days), and `long_term` (21 days onward).
Interpret performance using these stage records:
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
direct own-post matches, related matches and evidence classification. The candidate describes a proposed NEW subject, not the supporting spy post's subject. Keep its reader-question
type and answer method while verifying the new answer. After inspecting the actual selected origin, check
that the proposed content is substantively different from that origin, including internal origins.
If it merely repeats the origin, choose a meaningful subject variation within the assigned direction and
record why; do not count title paraphrases, factual corrections or artwork changes as a new topic.
Past performance supports the matched candidate only. If the variation changes the concrete question or
constraints beyond those matches, label that extension untested; do not claim direct performance proof for it. Read the assigned own-post evidence; a related post is not direct
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

Inspect the original hook and body as one composition. In presentation, record the observed cover wording
(including supporting copy), what it foregrounds, the reader question or promise it establishes, and how
the body answers it. Then map that relationship to the requested subject: propose the adapted hook and
identify how the planned body fulfills it. Keep the original framing and level of specificity while
changing concrete subject matter and expressing it in the persona's voice. Do not copy unsupported claims.
Do not invent an urgency, audience problem or benefit just to make the hook catchier, then retrofit each
body page with repeated justification for that angle. A new condition must materially guide the answer
and fit the source's hook-to-body relationship. If an automatic candidate fails this check, repair its
scope under the existing source_fit rules before handing it off. Respect explicit user constraints.

For automatic requests with origin=internal, select and inspect ONE directly matched internal project using
matching-stage performance and topic fit. Its actual reader question and
answer method must match the chosen topic. It is the format origin, not loose visual inspiration. Preserve its
page count, page order, each page's information role, element grouping and visual treatment. In presentation,
map every original page to its corresponding replacement content. An exercise card stays an exercise card;
it must not become a setup, progression, explanation or summary page. Do not combine formats from other posts.
Choose by topic/answer fit, never editing convenience. Do not expand an observed topic into an unsupported
second question (for example, adding limited-load progression to an exercise list). If no inspected source
can express the proposed subject faithfully, repair the generated subject/scope through source_fit; do not invent a format or silently
change the reader-question type to make a convenient template fit. A concrete generated subject may be revised to resolve a demonstrated source-capacity mismatch while keeping that question type and source composition.

For past_post variations, a replacement must perform the SAME INFORMATION ROLE in the SAME SLOT.
Describe the original information roles and map a different subject to them, retaining the reader question,
answer method and page progression. Changing only the angle of explanation about the same subject is not
that mode's requested variation. Do not force a different reader task into the same slot.

For automatic origin=spy, the server has already selected and preserved a spy composition origin. Follow the
external-reference contract, retaining its page count/order and information roles. No internal clone is needed.
Map the NEW topic into its existing page roles. Source content is evidence of composition, not the answer
to reuse. In reasoning.interpretations and presentation, state original subject → new subject, which concrete
items/claims change, and which page roles/layouts remain. Apply this comparison to internal origins too.
If the actual source composition cannot express the proposed topic, revise the automatically generated
subject or scope with production_change_direction(cause="source_fit", reason=...) while keeping the selected
composition and a genuinely new subject. Do not stop solely because a generated candidate named too few items.
Do not pad with repeated entries or unsupported distinctions. Map usable content to every original page role.
Set readiness.ready=true only when this mapping is complete and production can proceed; otherwise report
readiness.ready=false with the actual blocker so the same CLI can continue repairing before handoff.

For internal origins, record exactly one sources.clone_project_id for the inspected internal origin.
External origins, including automatic origin=spy, have no clone origin. Keep topic (subject), content_type (reader question and answer method)
and presentation (actual page structure and visuals) distinct. Record why the content is useful separately
from how it will be implemented.

## Verify the content in use

Before finalizing the direction, work through how the intended reader would understand, decide or
act on the proposed content and whether the resulting outcome serves its stated purpose. Check
relevant prerequisites, order and interactions between parts, rather than judging each item alone.
Identify the domain knowledge needed to resolve material uncertainty and verify it through internet
research using the attached research guide. Use the findings to correct the substance within the corresponding source slots.
Do not turn research findings into additional pages or change the source sequence; narrow unsupported
claims instead. Report a blocker if correctness cannot be preserved within the selected format.

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
