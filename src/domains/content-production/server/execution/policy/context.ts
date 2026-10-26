import type { Row, WorkDetail } from "../../../domain/contracts";

function currentCopy(value: unknown): Row {
  const content = value && typeof value === "object" ? value as Row : {};
  return {
    ...Object.fromEntries(["title","topic","message","content_type","hook","caption","hashtags"].filter(key=>key in content).map(key=>[key,content[key]])),
    slides:Array.isArray(content.slides)?content.slides.map(slide=>{
      const row=slide as Row;
      return Object.fromEntries(["slide_id","role","copy"].map(key=>[key,row[key]]));
    }):[],
  };
}
/** Visual review sees current content only, never clone identity or earlier reference analysis. */
export function stageContext(detail: WorkDetail): WorkDetail {
  if (detail.task.current_step !== "visual") return detail;
  const content=currentCopy(detail.polish?.content ?? detail.log.content_summary);
  return {
    task:detail.task,analysis:{},production:null,hook:null,analysis_inputs:[],external:{},
    log:{...Object.fromEntries(["id","topic","message","content_type"].map(key=>[key,detail.log[key]])),content_summary:content},
    polish:{content},visual:detail.visual?{state:detail.visual.state,content:currentCopy(detail.visual.content)}:null,
  };
}
