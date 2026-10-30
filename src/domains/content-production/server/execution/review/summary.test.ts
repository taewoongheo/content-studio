import test from "node:test";
import assert from "node:assert/strict";
import { createBlankDocument } from "@/domains/slideshow/editor/document";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import type { ContentJobRecord } from "@/domains/slideshow/domain/types";
import { reviewedSummary } from "./summary";

test("reviews use saved text and approved metadata, with repairs carried forward from every node", () => {
  const document=createBlankDocument({structure:"sequential",aspectRatio:"4:5",slideCount:1});
  document.slides[0].role="hook";
  document.elements.push(makeElementDefinition({id:"copy",kind:"text"}),makeElementDefinition({id:"brand",kind:"text",role:"badge"}));
  for(const [id,value] of [["copy","Saved persona hook"],["brand","BRAND"]]) document.slides[0].placements.push({id,elementId:id,value,frameOverride:null,styleOverride:null});
  const project={editor:{document}} as ContentJobRecord;
  const previous={topic:"Approved subject",message:"Approved answer",content_type:"List",title:"Title",caption:"Caption",hashtags:[],slides:[]};
  const reported={topic:"Corrected subject",title:"Polished title",caption:"Polished caption",hashtags:["tag"],hook:"Invented hook",changes:["Corrected wording"]};
  const hook=reviewedSummary("hook",previous,reported,project);
  assert.equal(hook.topic,"Corrected subject");assert.equal(hook.title,"Polished title");assert.equal(hook.hook,"Saved persona hook");
  assert.deepEqual((hook.slides as {copy:string[]}[])[0].copy,["Saved persona hook"]);
  const polish=reviewedSummary("polish",previous,reported,project);
  assert.equal(polish.title,"Polished title");assert.equal(polish.caption,"Polished caption");assert.equal(polish.topic,"Corrected subject");
});
