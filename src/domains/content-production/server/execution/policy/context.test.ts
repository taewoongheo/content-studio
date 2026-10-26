import test from "node:test";
import assert from "node:assert/strict";
import { stageContext } from "./context";
import type { WorkDetail } from "../../../domain/contracts";

test("visual context keeps current wording but strips references and copied layout descriptions",()=>{
  const reference="private-layout-reference";
  const content={title:"New title",topic:"New topic",message:"New answer",content_type:"Comparison",slides:[{slide_id:"s1",role:"body",copy:["Actual copy"],visual:reference}],changes:[reference]};
  const detail:WorkDetail={task:{id:"task",log_id:"log",project_id:"project",current_step:"visual",state:"running",created_at:"now",updated_at:"now",topic:"New topic",content_type:"Comparison"},
    analysis:{analysis:reference},production:{sources:[reference]},hook:{sources:[reference]},polish:{content,sources:[reference]},visual:{state:"stopped",review:reference},
    analysis_inputs:[{id:reference}],external:{},log:{id:"log",topic:"New topic",message:"New answer",content_type:"Comparison",analysis:reference,sources:[reference],content_summary:content}};
  const visible=stageContext(detail);
  assert.ok(!JSON.stringify(visible).includes(reference));
  assert.deepEqual((visible.polish?.content as {slides:unknown[]}).slides,[{slide_id:"s1",role:"body",copy:["Actual copy"]}]);
  assert.equal(visible.task.project_id,"project");
  assert.equal(stageContext({...detail,task:{...detail.task,current_step:"production"}}).analysis.analysis,reference);
});
