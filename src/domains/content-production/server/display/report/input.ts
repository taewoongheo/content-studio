import type { ProductionStep, Row, WorkDetail } from "../../../domain/contracts";
import { reportError, reportFields } from "../../../domain/report/model";

const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const opaque = /\b[a-f0-9]{24,64}\b/gi;
const url = /https?:\/\/[^\s)\]}>"']+/gi;
const hidden = new Set(["id","ids","project_id","project_ids","draft_id","log_id","slide_id","reviewed_slide_ids","visual_set_id","url","post_url","source","sources","tool_calls","call_id","revision","reviewed_revision","created_at","updated_at","completed_at","observed_at","started_at","finished_at"]);
export function buildReportInput(detail: WorkDetail, step: ProductionStep, ownPosts: Row[]) {
  const context=detail[step]??{};
  const external=Object.values(detail.external??{}).flatMap(group=>group?.posts??[]);
  const names=new Map<string,string>();
  for(const post of [...ownPosts,...external]) {
    const name=String(post.name||post.title||post.topic||String(post.caption??"").slice(0,100)||"참고 게시글");
    for(const id of [post.id,post.project_id,post.post_url,post.url])if(typeof id==="string")names.set(id,name);
  }
  const selected=detail.input?.source;
  if(selected){const name=selected.name||"선택한 원본 게시글";names.set(selected.id,name);if(selected.project_id)names.set(selected.project_id,name);if(selected.url)names.set(selected.url,name);}
  if(Array.isArray(context.slide_plan)) (context.slide_plan as Row[]).forEach((slide,index)=>{if(typeof slide.slide_id==="string")names.set(slide.slide_id,`${index+1}번째 슬라이드`);});
  const clean=(text:string)=>text.replace(url,value=>names.get(value)??"").replace(uuid,value=>names.get(value)??"").replace(/\bslide-[a-zA-Z0-9_-]+\b/g,value=>names.get(value)??"해당 슬라이드").replace(opaque,"").replace(/(?:\/Users\/|\/tmp\/|file:\/\/)\S+/g,"").replace(/\[\s*\]|\(\s*\)/g,"").trim();
  function prose(value: unknown): unknown {
    if(typeof value==="string")return clean(value);
    if(Array.isArray(value))return value.map(prose);
    if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([key])=>!hidden.has(key)).map(([key,item])=>[key,prose(item)]));
    return value;
  }
  const fields=Object.fromEntries(reportFields.filter(key=>key!=="sources"&&context[key]!=null).map(key=>[key,prose(context[key])]));
  const reasoning=context.reasoning as Row|undefined;
  if(reasoning&&Array.isArray(reasoning.observations)) {
    fields.reasoning={...prose(reasoning) as Row,observations:(reasoning.observations as Row[]).map(item=>({example:clean(String(item.source??"")),observation:prose(item.observation)}))};
  }
  if(Array.isArray(context.slide_plan))fields.slide_plan=(context.slide_plan as Row[]).map((slide,index)=>({page:index+1,...prose(slide) as Row}));
  const evidence=(Array.isArray(context.sources)?context.sources as Row[]:[]).map(source=>({
    example:names.get(String(source.id))??names.get(String(source.url))??"참고 사례",
    observation:clean(String(source.part??"")),application:clean(String(source.used_for??"")),
  }));
  return {stage:step,state:context.state,results:fields,evidence,error:prose(reportError(context))};
}
export type ReportInput = ReturnType<typeof buildReportInput>;
