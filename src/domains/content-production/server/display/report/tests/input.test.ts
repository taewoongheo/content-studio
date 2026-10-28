import test from "node:test";
import assert from "node:assert/strict";
import { buildReportInput } from "../input";
import { reportSourceKey } from "../../../../domain/report/model";
import type { WorkDetail } from "../../../../domain/contracts";
const id="12345678-1234-1234-1234-123456789012";
function detail():WorkDetail{return {task:{id:"draft",log_id:"log",current_step:"analysis",state:"running",created_at:"now",updated_at:"now",project_id:null,topic:null,content_type:null},analysis:{state:"completed",analysis:`Observed ${id}.`,reasoning:{observations:[{source:id,observation:"Clear exercise comparisons"}],interpretations:[],candidates:[]},research:[{question:"Why?",source:"https://example.com",finding:`Use ${id}`,judgment:"Useful comparison"}],sources:[{id,kind:"log",part:"Exercise ranking",used_for:"Explain the alternatives"}]},production:null,log:{}};}
test("report inputs connect recognizable examples to observations and remove technical source data without modifying drafts",()=>{
 const original=detail(),before=structuredClone(original);
 const input=buildReportInput(original,"analysis",[{id,name:"Back Exercise Ranking",project_id:"project"}]);
 assert.equal(input.evidence[0].example,"Back Exercise Ranking");
 assert.match(JSON.stringify(input),/Clear exercise comparisons/);assert.match(JSON.stringify(input),/Back Exercise Ranking/);
 assert.doesNotMatch(JSON.stringify(input),new RegExp(id));assert.doesNotMatch(JSON.stringify(input),/https:|visual_set_id|tool_calls/);
 assert.deepEqual(original,before);
});
test("revisions ignore bookkeeping, include meaningful state/content changes and omit empty pending stages",()=>{
 const value=detail(),key=reportSourceKey(value,"analysis");
 value.analysis.updated_at="later";assert.equal(reportSourceKey(value,"analysis"),key);
 value.analysis.analysis="New decision";assert.notEqual(reportSourceKey(value,"analysis"),key);
 value.analysis={state:"pending",research:[],sources:[]};assert.equal(reportSourceKey(value,"analysis"),"");
 value.analysis={state:"failed",error:{code:"OUTPUT_SCHEMA_INVALID",message:"Missing output",tool_calls:[{status:"failed",message:"Source could not be cloned",input:{token:"private"}}]}};
 const input=buildReportInput(value,"analysis",[]);
 assert.match(JSON.stringify(input),/Source could not be cloned/);assert.doesNotMatch(JSON.stringify(input),/private|OUTPUT_SCHEMA_INVALID|tool_calls/);
});
