import type { Row, WorkDetail } from "@/domains/content-production/domain/contracts";
import { projectReferences } from "../../../model/project-references";

export function ProjectReferences({ detail, logs, visuals, references, onOpen }: {
  detail: WorkDetail; logs: Row[]; visuals: Row[]; references: Row[]; onOpen: (id: string) => void;
}) {
  const origins = projectReferences(detail, logs, visuals, references);
  return <section className="mt-6 space-y-3" aria-label="제작에 사용한 원본">
    <h4 className="text-sm font-semibold">참고한 원본</h4>
    {origins.length === 0 ? <p className="text-sm text-muted-foreground">저장된 원본 정보가 없습니다.</p> : origins.map(origin => <article key={origin.label} className="min-w-0 rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{origin.label}</p>
      <p className="mt-1 break-words text-sm font-medium">{origin.name}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {origin.projectId && <button className="production-button" onClick={() => onOpen(origin.projectId!)}>원본 프로젝트 열기</button>}
        {origin.url && <a className="production-button" href={origin.url} target="_blank" rel="noreferrer">원본 게시글 ↗</a>}
      </div>
      {origin.setId && origin.slideCount > 0 && <div role="region" aria-label={`${origin.label} 슬라이드`} tabIndex={0} className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {Array.from({length:origin.slideCount},(_,index) => {
          const url = `/api/content-production?image=${encodeURIComponent(origin.setId!)}&slide=${index}`;
          return <a key={index} href={url} target="_blank" rel="noreferrer" className="shrink-0" aria-label={`원본 ${index+1}번 슬라이드 크게 보기`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`원본 ${index+1}번 슬라이드`} loading="lazy" decoding="async" className="h-44 w-auto rounded border bg-muted" />
          </a>;
        })}
      </div>}
    </article>)}
  </section>;
}
