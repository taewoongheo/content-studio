import type { Row } from "../../domain/contracts";
import type { TopicCandidate, TopicMatch, TopicStatus } from "../../domain/topics/model";

export function rate(row: Row) {
  const values = [row.view_count, row.like_count, row.comment_count, row.save_count];
  if (!values.every(value => typeof value === "number" && Number.isFinite(value) && value >= 0)
    || Number(row.view_count) < 500) return null;
  return (Number(row.like_count) + Number(row.comment_count) + Number(row.save_count)) / Number(row.view_count);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** An operational evidence screen, not a significance test or causal format claim. */
export function evaluateTopics(candidates: TopicCandidate[], matches: TopicMatch[], performance: Row[]) {
  // Index once; evaluating another candidate must not rescan the full performance history.
  const stages = new Map<string, Map<string, number>>();
  for (const row of performance) {
    const value = rate(row);
    if (value === null) continue;
    const stage = String(row.stage), records = stages.get(stage) ?? new Map<string, number>();
    records.set(String(row.log_id), value);
    stages.set(stage, records);
  }
  const baselines = new Map([...stages].flatMap(([stage, records]) =>
    records.size >= 3 ? [[stage, median([...records.values()])] as const] : []));
  const byCandidate = new Map(matches.map(match => [match.candidate_id, match]));

  return candidates.map(candidate => {
    const match = byCandidate.get(candidate.id);
    if (!match) throw new Error("주제 후보에 연결된 게시 이력 분석이 없습니다.");
    let supportedStage: string | null = null, score = 0;
    for (const [stage, baseline] of baselines) {
      const records = stages.get(stage)!;
      const qualified = [...new Set(match.direct_log_ids)].flatMap(id => {
        const value = records.get(id);
        return value !== undefined && value >= baseline ? [value] : [];
      });
      if (qualified.length < 2) continue;
      const mean = qualified.reduce((sum, value) => sum + value, 0) / qualified.length;
      if (!supportedStage || mean > score) { supportedStage = stage; score = mean; }
    }
    const status: TopicStatus = supportedStage ? "proven" : match.direct_log_ids.length ? "inconclusive" : "untried";
    return {
      candidate, match, status, score,
      evidence: supportedStage
        ? `At least two direct posts at ${supportedStage}, each with at least 500 views and response at or above that stage's median. ${match.reason}`
        : `${status === "untried" ? "No direct publication history." : "Direct history exists, but repeated stage-matched evidence is insufficient."} ${match.reason}`,
    };
  });
}
