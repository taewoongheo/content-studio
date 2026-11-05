import test from "node:test";
import assert from "node:assert/strict";
import { assertLayoutReview, type LayoutObservation } from "./layout";
import { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import type { LayoutCheck } from "../../../domain/planning/layout";
function fixture(){
 const r=new ContentJobRegistry(),job=r.add({structure:"sequential",aspectRatio:"4:5",slideCount:1,outputLanguage:"English"});
 const project=r.getRecord(job.id);project.editor.document.slides[0].role="body";
 const id=project.editor.document.slides[0].id;
 const box={x:10,y:10,width:100,height:20};
 const observed:LayoutObservation={revision:project.editor.revision,slides:new Map([[id,{slideId:id,width:1080,height:1350,elements:[
  {placementId:"a",elementId:"a",role:"copy",kind:"text",frame:{...box,height:200},visible:box},
  {placementId:"b",elementId:"b",role:"tip",kind:"text",frame:{...box,y:180},visible:{...box,y:44}},
 ]}]])};
 const check:LayoutCheck={slide_id:id,from_id:"a",to_id:"b",axis:"y",min_gap:24,max_gap:32,reason:"copy to tip"};
 return {project,observed,check};
}
test("completion rejects measured 14px gap even when the reported review passed",()=>{
 const {project,observed,check}=fixture();
 assert.throws(()=>assertLayoutReview(project,[check],observed),{code:"LAYOUT_GAP_MISMATCH"});
 observed.slides.values().next().value!.elements[1].visible!.y=58;
 assert.doesNotThrow(()=>assertLayoutReview(project,[check],observed));
});
test("stale, missing, invented and empty body checks cannot satisfy layout completion",()=>{
 const {project,observed,check}=fixture();
 assert.throws(()=>assertLayoutReview(project,[check]),{code:"LAYOUT_REVIEW_STALE"});
 assert.throws(()=>assertLayoutReview(project,[check],{...observed,revision:99}),{code:"LAYOUT_REVIEW_STALE"});
 assert.throws(()=>assertLayoutReview(project,[],observed),{code:"LAYOUT_CHECKS_MISSING"});
 assert.throws(()=>assertLayoutReview(project,[{...check,to_id:"missing"}],observed),{code:"LAYOUT_CHECK_INVALID"});
 assert.throws(()=>assertLayoutReview(project,[{...check,min_gap:40,max_gap:20}],observed),{code:"LAYOUT_CHECK_INVALID"});
});
