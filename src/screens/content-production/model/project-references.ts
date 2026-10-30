import type { Row, WorkDetail } from "@/domains/content-production/domain/contracts";

export interface ProjectReference {
  label: string;
  name: string;
  projectId?: string;
  url?: string;
  setId?: string;
  slideCount: number;
}
const text = (value: unknown) => typeof value === "string" && value.trim() ? value : undefined;
const webUrl = (value: unknown) => {
  const url = text(value);
  try { return url && ["https:", "http:"].includes(new URL(url).protocol) ? url : undefined; }
  catch { return undefined; }
};

/** Show selected origins, not every post read during candidate comparison. */
export function projectReferences(detail: WorkDetail, logs: Row[], visuals: Row[], references: Row[]): ProjectReference[] {
  const sources = Array.isArray(detail.analysis.sources) ? detail.analysis.sources as Row[] : [];
  const origin = sources.find(source => text(source.clone_project_id));
  const projectId = text(origin?.clone_project_id) ?? detail.input?.source?.project_id;
  const result: ProjectReference[] = [];
  if (projectId) {
    const log = logs.find(log => log.project_id === projectId);
    const url = webUrl(log?.post_url) ?? webUrl(origin?.url);
    const visual = visuals.find(visual => (log && visual.log_id === log.id) || (url && visual.source_url === url));
    result.push({ label: "복제한 내부 원본", name: text(log?.title) ?? text(log?.topic) ?? "내 게시글 원본", projectId, url,
      setId: text(visual?.id), slideCount: Number(visual?.slide_count ?? 0) });
  }
  const input = detail.input;
  if (input?.request.mode === "external_url" || input?.request.mode === "spy_reference") {
    const source = input.source;
    const request = input.request;
    const reference = references.find(reference => request.mode === "spy_reference" ? reference.id === request.referenceId : reference.url === request.url);
    const url = webUrl(source?.url) ?? webUrl(reference?.url) ?? (request.mode === "external_url" ? webUrl(request.url) : undefined);
    const visual = visuals.find(visual => visual.source_url === url);
    result.unshift({label: "지정한 외부 레퍼런스", name: source?.name ?? text(reference?.title) ?? "외부 게시글 원본", url,
      setId: source?.visual_set_id ?? text(reference?.visual_set_id) ?? text(visual?.id),
      slideCount: source?.slide_count ?? Number(reference?.slide_count ?? visual?.slide_count ?? 0)});
  }
  return result;
}
