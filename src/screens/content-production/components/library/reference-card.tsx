import type { Row } from "@/domains/content-production/domain/contracts";
export function ReferenceCard({ post, onExclude }: { post: Row; onExclude?: (excluded: boolean) => void }) {
  const count = (key: string) => typeof post[key] === "number" ? Number(post[key]).toLocaleString("ko-KR") : "미제공";
  return <article className="rounded-xl border p-4">
    <div className="flex items-start justify-between gap-3">
      <a className="min-w-0 break-words text-sm font-semibold underline" href={String(post.url)} target="_blank" rel="noreferrer">{String(post.title || `@${post.account}`)} ↗</a>
      {onExclude && <button className="production-button shrink-0" onClick={() => onExclude(!post.excluded)}>{post.excluded ? "복원" : "제외"}</button>}
    </div>
    {!!post.topic && <p className="mt-2 text-sm">{String(post.topic)}</p>}
    {!!post.content_type && <p className="mt-1 text-xs text-muted-foreground">{String(post.content_type)}</p>}
    <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{String(post.caption ?? "")}</p>
    <dl className="mt-3 grid grid-cols-3 gap-3">{[["view_count","조회"],["like_count","좋아요"],["comment_count","댓글"],["save_count","저장"],["share_count","공유"]].map(([key,label])=><div key={key}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm font-semibold">{count(key)}</dd></div>)}</dl>
    <p className="mt-2 text-xs text-muted-foreground">반응률 {typeof post.engagement_rate === "number" ? `${(post.engagement_rate*100).toFixed(2)}%` : "미제공"}{post.published_at ? ` · ${new Date(String(post.published_at)).toLocaleDateString("ko-KR")}` : ""}</p>
    {!!post.visual_set_id && <div className="mt-3 flex gap-2 overflow-x-auto">{Array.from({length:Number(post.slide_count??0)},(_,index)=><a key={index} className="shrink-0" target="_blank" rel="noreferrer" href={`/api/content-production?image=${encodeURIComponent(String(post.visual_set_id))}&slide=${index}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" src={`/api/content-production?image=${encodeURIComponent(String(post.visual_set_id))}&slide=${index}`} alt={`@${String(post.account)} 슬라이드 ${index+1}`} className="h-36 w-auto rounded border" />
    </a>)}</div>}
    {!!post.image_error && <p className="mt-2 text-xs text-destructive">슬라이드 이미지 수집 실패</p>}
    {!!post.notes && <p className="mt-3 whitespace-pre-wrap border-t pt-3 text-xs leading-5">{String(post.notes)}</p>}
  </article>;
}
