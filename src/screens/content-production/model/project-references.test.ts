import test from "node:test";
import assert from "node:assert/strict";
import type { WorkDetail } from "@/domains/content-production/domain/contracts";
import { projectReferences } from "./project-references";

const detail = (input?: WorkDetail["input"]) => ({input, analysis:{sources:[
  {id:"comparison",url:"https://example.com/comparison"},
  {id:"selected",clone_project_id:"origin",url:"https://example.com/own"},
]}} as unknown as WorkDetail);

test("shows only the selected internal origin and resolves its preserved slides", () => {
  const result = projectReferences(detail(), [{id:"selected",project_id:"origin",topic:"Original topic",post_url:"https://example.com/own"}],
    [{id:"slides",log_id:"selected",slide_count:8}], []);
  assert.equal(result.length,1);
  assert.deepEqual(result[0],{label:"복제한 내부 원본",name:"Original topic",projectId:"origin",url:"https://example.com/own",setId:"slides",slideCount:8});
});

test("external URL and library inputs show preserved external material plus the internal clone", () => {
  for (const request of [{mode:"external_url",url:"https://example.com/external",instructions:""},
    {mode:"spy_reference",referenceId:"ref",instructions:""}] as const) {
    const input = {request,source:{id:"ref",name:"External source",url:"https://example.com/external",visual_set_id:"external-slides",slide_count:5}};
    const result=projectReferences(detail(input),[],[],[]);
    assert.equal(result.length,2);
    assert.equal(result[0].setId,"external-slides");
    assert.equal(result[0].slideCount,5);
    assert.equal(result[1].projectId,"origin");
    assert.equal(result[1].url,"https://example.com/own");
  }
});

test("missing origin metadata keeps the selected project accessible without listing unrelated candidates", () => {
  const result=projectReferences(detail({request:{mode:"past_post",sourceProjectId:"origin",instructions:""},source:{id:"log",project_id:"origin"}}),[],[],[]);
  assert.equal(result.length,1);
  assert.equal(result[0].projectId,"origin");
  assert.deepEqual(projectReferences({analysis:{sources:[]}} as unknown as WorkDetail,[],[],[]),[]);
});

test("automatic spy origin uses its selected post rather than comparison candidates", () => {
  const input: WorkDetail["input"] = {
    request: {mode:"automatic",instructions:""}, origin:"spy",
    source:{id:"selected-spy",url:"https://www.tiktok.com/@source/photo/123",name:"Selected source",visual_set_id:"slides",slide_count:7},
  };
  const result = projectReferences({input,analysis:{sources:[{id:"comparison",url:"https://www.tiktok.com/@other/photo/456"}]}} as unknown as WorkDetail,[],[],[]);
  assert.equal(result.length,1);
  assert.equal(result[0].url,input.source!.url);
  assert.equal(result[0].setId,"slides");
});

test("own-post origin resolves its published URL and rejects unsafe fallback links", () => {
  const input: WorkDetail["input"] = {request:{mode:"past_post",sourceProjectId:"origin",instructions:""},source:{id:"log",project_id:"origin"}};
  const current = {input,analysis:{sources:[{clone_project_id:"origin",url:"javascript:alert(1)"}]}} as unknown as WorkDetail;
  assert.equal(projectReferences(current,[{project_id:"origin",post_url:"https://www.tiktok.com/@own/video/123"}],[],[])[0].url,"https://www.tiktok.com/@own/video/123");
  assert.equal(projectReferences(current,[],[],[])[0].url,undefined);
});
