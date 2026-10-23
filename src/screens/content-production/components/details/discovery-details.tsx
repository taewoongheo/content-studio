import type { DiscoveryBatch } from "@/domains/content-production/domain/discovery";
import { metricKeys } from "@/domains/content-production/domain/performance";

const labels = { view_count: "조회", like_count: "좋아요", save_count: "저장", comment_count: "댓글", share_count: "공유" };
const format = (value: number | null) => value === null ? "미제공" : value.toLocaleString("ko-KR");
export function DiscoveryDetails({ batch }: { batch: DiscoveryBatch }) {
  return <section className="mt-6 border-t pt-5" aria-label="외부 검색 자료">
    <h3 className="font-semibold">외부 검색 자료 · {batch.posts.length}개</h3>
    <p className="mt-2 text-xs text-muted-foreground">검색어: {batch.query} · {new Date(batch.collected_at).toLocaleString("ko-KR")}</p>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">인기 검색 후보입니다. 타겟 적합성과 실제 슬라이드를 확인한 뒤 참고합니다. 모든 제작 작업이 같은 자료를 사용합니다.</p>
    <div className="mt-4 space-y-4">{batch.posts.map(post => <article key={post.id} className="rounded-lg border p-4">
      <a href={post.url} target="_blank" rel="noreferrer" className="break-all text-sm font-semibold underline">@{post.account ?? post.id} ↗</a>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{post.caption || "캡션 없음"}</p>
      <p className="mt-2 text-xs text-muted-foreground">게시 {post.published_at ? new Date(post.published_at).toLocaleString("ko-KR") : "미확인"}</p>
      <p className="mt-2 text-sm font-medium">반응률 {post.engagement_rate === null ? "미제공" : `${(post.engagement_rate * 100).toFixed(2)}%`}</p>
      <dl className="mt-3 grid grid-cols-3 gap-3">{metricKeys.map(key => <div key={key}><dt className="text-xs text-muted-foreground">{labels[key]}</dt><dd className="mt-1 font-semibold">{format(post[key])}</dd></div>)}</dl>
      {post.visual_set_id && <div className="mt-3 flex gap-2 overflow-x-auto">{Array.from({ length: post.slide_count }, (_, index) => <a key={index} href={`/api/content-production?image=${encodeURIComponent(post.visual_set_id!)}&slide=${index}`} target="_blank" rel="noreferrer" className="shrink-0">
        {/* Stored platform slides retain their original composition. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" src={`/api/content-production?image=${encodeURIComponent(post.visual_set_id!)}&slide=${index}`} alt={`@${post.account ?? post.id} 슬라이드 ${index + 1}`} className="h-36 w-auto rounded border" />
      </a>)}</div>}
      {post.image_error && <p className="mt-3 text-xs text-destructive">슬라이드 이미지를 보존하지 못했습니다. 캡션만으로 내용을 판단하지 않습니다.</p>}
    </article>)}</div>
    {!batch.posts.length && <p className="mt-3 text-sm text-muted-foreground">이번 검색에서 조건에 맞는 슬라이드쇼를 찾지 못했습니다.</p>}
  </section>;
}
