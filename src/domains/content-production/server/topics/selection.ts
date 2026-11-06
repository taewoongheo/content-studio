import type { TopicAssignment, TopicLane } from "../../domain/topics/model";
import type { evaluateTopics } from "./evidence";
type Evaluated = ReturnType<typeof evaluateTopics>[number];
export function selectTopics(candidates: Evaluated[], count: number, previous: {
  candidate_id: string;
  requested_lane: TopicLane;
}[], random = Math.random): TopicAssignment[] {
  if (count && !candidates.length)
    throw new Error("사용 가능한 주제 후보가 없습니다.");
  const uses = new Map<string, number>();
  previous.forEach(row => uses.set(row.candidate_id, (uses.get(row.candidate_id) ?? 0) + 1));
  let lane: TopicLane = previous.at(-1)?.requested_lane === 'proven' ? 'exploration' : 'proven';
  const selected: TopicAssignment[] = [], batch = new Set<string>();
  for (let i = 0; i < count; i++) {
    const unused = candidates.filter(row => !batch.has(row.candidate.id));
    const eligible = unused.length ? unused : candidates;
    let pool = eligible.filter(row => lane === 'proven' ? row.status === 'proven' : row.status === 'untried');
    let fallback: string | null = unused.length ? null : 'All candidates have already been assigned in this batch; reusing a candidate subject to the existing overlap check.';
    if (!pool.length) {
      pool = eligible.filter(row => row.status === 'untried');
      if (!pool.length)
        pool = eligible.filter(row => row.status === 'inconclusive');
      if (!pool.length)
        pool = eligible.filter(row => row.status === 'proven');
      fallback = `No unused ${lane === 'proven' ? 'repeatedly supported' : 'untried'} candidates available; selected ${pool[0].status} evidence without relabeling it.`;
    }
    const least = Math.min(...pool.map(row => uses.get(row.candidate.id) ?? 0));
    pool = pool.filter(row => (uses.get(row.candidate.id) ?? 0) === least);
    if (lane === 'proven' && pool.every(row => row.status === 'proven')) {
      const best = Math.max(...pool.map(row => row.score));
      pool = pool.filter(row => row.score === best);
    }
    const chosen = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    selected.push({ candidate: chosen.candidate, requested_lane: lane, selected_lane: chosen.status === 'proven' ? 'proven' : 'exploration', status: chosen.status,
      direct_log_ids: chosen.match.direct_log_ids, related_log_ids: chosen.match.related_log_ids, evidence: chosen.evidence, fallback });
    uses.set(chosen.candidate.id, (uses.get(chosen.candidate.id) ?? 0) + 1);
    batch.add(chosen.candidate.id);
    lane = lane === 'proven' ? 'exploration' : 'proven';
  }
  return selected;
}
