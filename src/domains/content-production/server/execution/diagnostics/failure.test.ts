import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { beginToolCall, finishToolCall } from "./tools";
import { productionFailure, requiredToolFailure } from "./failure";

test("missing, failed, pending and empty reference calls have distinct persisted diagnostics", () => {
  const name = "production_preview_project";
  const code = (calls: ReturnType<typeof beginToolCall>[]) => requiredToolFailure(calls,[name],"Source review").code;
  assert.equal(code([]),"REQUIRED_TOOL_NOT_CALLED");
  const call=beginToolCall("1",name,{projectId:"saved",token:"secret",commands:["private"]});
  assert.deepEqual(call.input,{projectId:"saved"});
  assert.equal(code([call]),"REQUIRED_TOOL_INCOMPLETE");
  finishToolCall(call,{isError:true,content:[],structuredContent:{error:{code:"SOURCE_RENDER_FAILED",message:"Rendering failed"}}});
  assert.equal(code([call]),"REQUIRED_TOOL_FAILED");
  const failure=productionFailure(requiredToolFailure([call],[name],"Source review"),"visual","validation",[call]);
  assert.equal(failure.tool_calls[0].code,"SOURCE_RENDER_FAILED");
  assert.equal(failure.phase,"validation");
  const empty=beginToolCall("2",name,{});finishToolCall(empty,{content:[{type:"text",text:"No images"}]});
  assert.equal(code([empty]),"REQUIRED_TOOL_EMPTY_RESULT");
  const image=beginToolCall("3",name,{});finishToolCall(image,{content:[{type:"image",mimeType:"image/png",data:"test"}]});
  assert.equal(image.status,"succeeded");
});
test("schema mismatch is distinguished from validation and execution failures", () => {
  const invalid=z.object({sources:z.array(z.string())}).safeParse({sources:"wrong"});
  assert.equal(invalid.success,false);if(invalid.success)return;
  const output=productionFailure(invalid.error,"analysis","output",[]);
  assert.equal(output.code,"OUTPUT_SCHEMA_INVALID");assert.ok(output.details.issues);
  assert.equal(productionFailure(invalid.error,"analysis","save",[]).code,"DRAFT_VALIDATION_FAILED");
  assert.equal(productionFailure(new Error("disk failed"),"production","save",[]).phase,"save");
});
