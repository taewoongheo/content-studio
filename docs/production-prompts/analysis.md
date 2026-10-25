# Analysis and direction

## Read and compare

Call production_query(kind="logs") without a keyword to read the comparison pool: up to ten
highest-rate posts, ten lowest excluding the first group, then ten newest excluding both groups.
The rate is (likes + comments + saves) / views. Missing metrics or zero views exclude rate ranking,
not recency. Consider all available groups, not just the strongest individual example.
Keyword queries return the same selection within matching topic/title text; use them when a relevant
group needs more examples. The "recent" group is the newest REMAINING posts, not the absolute latest ten.
For novelty checks, sort the combined pool by actual_published_at and inspect its newest ten.
Compare external alternatives with production_external_references at least once before completion.
Inspect actual copy and source images for the examples used to explain reader experience or visual features.
Group multiple posts by broad presentation format across exercise subjects. Choice/comparison,
explanation, ranking and ready-to-use routine are examples, never an exhaustive list.
Use docs/content-metadata.md to distinguish topic, message and content_type; classify similar
information/visual structures together without requiring the same exercise subject.
Do not narrow the main groups to combinations such as back-exercise explanation.
Follow the grouped-comparison criteria in docs/research-guidelines.md and distinguish:

- Format/value patterns: how broadly similar structures and the answers themselves relate to response.
- Presentation patterns: how hook wording, images, text density and layout deliver that answer.
Compare stronger and weaker cases within a type and different types with similar presentation.
Keep content_type broad; store the specific exercise subject in topic.

## Assess content value and delivery

For the examples that influence your decision, identify the log, relevant slide/copy and metrics.
Connect the observation to the reader's experience:

1. What situation or desired outcome does the hook address, and what answer does it promise?
2. What answer does the post actually deliver? Is it a finished plan, a usable choice, a demonstration,
   or advice the reader must turn into their own plan?
3. What value does the reader gain: a usable plan, understanding, comparison, discovery, motivation,
   or another benefit? Explain how the actual content and presentation deliver that value.
   Do not automatically penalize complexity, further thought or interpretation, or prefer simple topics.
4. Why might that experience have encouraged or weakened saving, liking, commenting or continuing?
   Compare specific stronger and weaker examples and state a concrete working estimate.
5. Which lesson will you apply to this draft, and why does it help the upper-level goal?

Do not stop at "large images," "too much text" or "explanation-heavy."
Explain how the intended value becomes clear or is weakened, identifying where it happens in the post.
Also evaluate the appeal of the topic and answer itself, not only its packaging.
Do not treat an explanation-led content type and dense explanatory text as the same weakness.
A ready-to-use answer and general advice may differ in value even if both have clean layouts.

Consider differences in views, audience and topic, and relevant counterexamples.
Lower engagement is not the same as no response.

## Explore topics and select an answer

Use internet and community searches under the research guide to find situations,
questions, desired outcomes and the language people use. Save the source and what you learned.

Compare materially different topic/answer candidates using both those findings and the past-post
analysis. Explain why the selected answer is more useful or compelling for this audience.
Do not automatically reuse a weak post's topic simply because its presentation can be improved.
Successful topics can be developed for a new situation; do not restrict all candidates to one
recurring training decision.

Choose one topic, concrete message, free-text format, complete answer and presentation direction,
following docs/content-metadata.md. Explain the expected response,
goal connection and difference from recent content. View actual references for the visual direction.
Plan enough slides to satisfy docs/content-guidelines.md without dense text-only pages.

## Check recent overlap

Call production_comparisons before choosing the direction and again before finalizing it.
It includes retained drafts and posts published within 24 hours. Reusing an older successful topic
is allowed when the new post provides a distinct answer or situation.
For recent overlap, the same topic AND broad content type is a duplicate. Pending ideas do not reserve
that combination; the first saved actual content keeps it. Adjust this analysis draft if needed.
production_change_direction is unavailable here; it is a first-draft production tool.

## Save and finish

In the existing analysis field, separately record content-type/value patterns and presentation
patterns, citing supporting posts and counterexamples. Then connect both assessments to the
candidate selection and reader-experience estimates. Save the direction, research and sources to this draft.
Do not create or edit a project here.
Return analysis and every direction field as strings, plus structured sources.
The harness validates and saves the result before first-draft production starts.
