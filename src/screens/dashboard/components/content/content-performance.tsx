import { performanceStages } from "@/domains/content-production/domain/performance";
import type { PublishedPost } from "@/domains/content-production/domain/published-posts";
const metrics = [["view_count","조회"],["like_count","좋아요"],["comment_count","댓글"],["save_count","저장"],["share_count","공유"]] as const;
export function ContentPerformance({records}: {records:NonNullable<PublishedPost["performance"]>}) {
  return <div className="mt-4 overflow-x-auto"><table className="w-full text-right text-xs"><caption className="sr-only">구간별 수집 성과</caption><thead><tr><th className="p-2 text-left">수집 구간</th>{metrics.map(([key,label]) => <th className="p-2" key={key}>{label}</th>)}</tr></thead><tbody>{performanceStages.map(({stage,label}) => {
    const record = records.find(row => row.stage === stage);
    return <tr key={stage} className="border-t"><th scope="row" className="whitespace-nowrap p-2 text-left font-normal">{label}{!record && <span className="ml-2 text-muted-foreground">미수집</span>}</th>{metrics.map(([key]) => <td className="p-2 tabular-nums" key={key}>{record ? record[key]?.toLocaleString("ko-KR") ?? "미제공" : "—"}</td>)}</tr>;
  })}</tbody></table></div>;
}
