import { X } from "lucide-react";
import { metricKeys, type PerformanceRefresh } from "@/domains/content-production/domain/performance";
import type { Row, WorkDetail } from "@/domains/content-production/domain/contracts";

const labels = { view_count: "조회", like_count: "좋아요", save_count: "저장", comment_count: "댓글", share_count: "공유" };
const numbers = new Intl.NumberFormat("ko-KR");
function time(value: unknown) {
  return typeof value === "string" ? new Date(value).toLocaleString("ko-KR") : "미확인";
}

export function PerformanceDetails({ report, logs, details, onClose }: {
  report: PerformanceRefresh | null; logs: Row[]; details: Record<string, WorkDetail>; onClose: () => void;
}) {
  const selected = new Map<string, {name:string;reason:string}[]>();
  for (const detail of Object.values(details)) {
    const sources = Array.isArray(detail.analysis.sources) ? detail.analysis.sources as Row[] : [];
    for (const source of sources) {
      const log = logs.find(log => (source.kind === "log" && source.id === log.id) || (source.url && source.url === log.post_url));
      if (!log) continue;
      const entries = selected.get(String(log.id)) ?? [];
      const entry = {name:String(detail.task.topic ?? "분석 중"),reason:String(source.used_for ?? source.part ?? "")};
      if (!entries.some(value => value.name === entry.name && value.reason === entry.reason)) entries.push(entry);
      selected.set(String(log.id),entries);
    }
  }
  const refreshedIds = new Set(report?.records.map(row => row.log_id) ?? []);
  const rows = logs;
  return <section className="p-5" aria-label="분석 참고 게시글">
    <header className="flex items-center justify-between gap-4">
      <h2 className="font-semibold">분석 참고 게시글</h2>
      <button className="production-button" aria-label="성과 상세 닫기" onClick={onClose}><X size={16} /></button>
    </header>
    <p className="mt-3 text-xs text-muted-foreground">{report
      ? report.state === "running" ? "게시글 성과 갱신 중 · 아래 수치는 마지막 저장값입니다."
        : report.state === "failed" ? "갱신 실패 · 이전 저장값을 유지합니다."
        : `최근 게시글 ${report.records.length}개 갱신 완료 · ${time(report.completed_at)}`
      : "저장된 최신 성과"}</p>
    {report?.error && <p role="alert" className="mt-3 text-sm text-destructive">{report.error}</p>}
    <p className="mt-2 text-xs leading-5 text-muted-foreground">성과 후보 중 무작위 5개와 최근 5개를 중복 없이 보여줍니다. 반응률은 (좋아요 + 댓글 + 저장) ÷ 조회 수로 계산합니다.</p>
    <div className="mt-5 space-y-4">
      {rows.map(row => <article key={String(row.id)} className="rounded-lg border p-4">
        <a className="text-sm font-semibold hover:underline" href={String(row.post_url)} target="_blank" rel="noreferrer">{String(row.name ?? row.topic ?? "콘텐츠")}</a>
        <p className="mt-2 text-xs text-muted-foreground">{row.selection_group === "performance" ? "성과 후보에서 무작위 선정" : "최신 게시글"} · 게시 {time(row.actual_published_at)}</p>
        {typeof row.engagement_rate === "number" && <p className="mt-2 text-sm font-medium">반응률 {(row.engagement_rate * 100).toFixed(2)}%</p>}
        <dl className="mt-4 grid grid-cols-3 gap-3">{metricKeys.map(key => <div key={key}>
          <dt className="text-xs text-muted-foreground">{labels[key]}</dt>
          <dd className="mt-1 text-base font-semibold">{typeof row[key] === "number" ? numbers.format(row[key]) : "미제공"}</dd>
        </div>)}</dl>
        <p className="mt-3 text-xs text-muted-foreground">관측 {time(row.observed_at)}{refreshedIds.has(String(row.id)) ? " · 이번 갱신 대상" : ""}</p>
        {selected.get(String(row.id))?.map((entry,index) => <div key={index} className="mt-3 border-t pt-3 text-xs leading-5">
          <p className="font-medium">{entry.name}에서 참고</p><p className="text-muted-foreground">{entry.reason}</p>
        </div>)}
      </article>)}
      {!rows.length && <p className="text-sm text-muted-foreground">분석에 참고할 게시글이 없습니다.</p>}
    </div>
  </section>;
}
