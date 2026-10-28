import type { StageReport } from "@/domains/content-production/domain/report/model";

export function StageReportView({report}:{report:StageReport}) {
  return <article className="min-w-0 space-y-7" aria-label="정리된 단계 결과">
    <header className="space-y-3 border-b pb-5">
      <h4 className="break-words text-lg font-semibold leading-7">{report.headline}</h4>
      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{report.summary}</p>
    </header>
    {report.sections.filter(section=>section.paragraphs.length||section.items.length).map((section,index)=><section key={index} className="min-w-0 space-y-3">
      <h5 className="text-sm font-semibold">{section.title}</h5>
      {section.paragraphs.map((text,index)=><p key={index} className="whitespace-pre-wrap break-words text-sm leading-7">{text}</p>)}
      {section.items.length>0&&<div className="space-y-4">{section.items.map((item,index)=><div key={index} className="min-w-0 border-l-2 border-border pl-4">
        {item.title&&<h6 className="text-sm font-medium leading-6">{item.title}</h6>}
        {item.quote&&<blockquote className="my-2 whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-sm font-medium leading-7">{item.quote}</blockquote>}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{item.body}</p>
      </div>)}</div>}
    </section>)}
    {!!report.next_actions.length&&<section className="rounded-lg bg-muted/40 p-4">
      <h5 className="mb-2 text-sm font-semibold">남은 작업</h5>
      <ul className="list-disc space-y-2 pl-4 text-sm leading-7">{report.next_actions.map((text,index)=><li key={index}>{text}</li>)}</ul>
    </section>}
  </article>;
}
