import assert from "node:assert/strict";
import test from "node:test";
import type { CodexJsonValue, CodexUserInput } from "../../../../codex/transport/types";
import type { ContentJobInput } from "../../../domain/types";
import { ContentJobRegistry } from "../../../workflow/registry";
import { CodexChatRouter } from "./router";

const input: ContentJobInput = {
  model: "gpt-6-luna", structure: "repeating", aspectRatio: "9:16", slideCount: 4,
  outputLanguage: "English", referenceImages: [],
  productContext: { name: "LiftCode", description: "운동 앱", audience: "운동 사용자", constraints: "" },
};

test("내부 라우터는 같은 Codex 쓰레드에서 허용된 동작만 반환한다", async () => {
  const registry = new ContentJobRegistry({ createId: () => "job" });
  registry.add(input, "thread-1");
  const received: Array<{ threadId: string; input: CodexUserInput[]; outputSchema: CodexJsonValue }> = [];
  const codex = { async runStructuredTurn(request: {
    threadId: string; input: CodexUserInput[]; outputSchema: CodexJsonValue;
  }) {
    received.push(request);
    return { status: "completed" as const, threadId: request.threadId, turnId: "turn-1",
      output: { capability: "propose_topics", proposalSetId: "", candidateId: "", slideId: "" } };
  } };
  const route = await new CodexChatRouter(codex).route({
    job: registry.getRecord("job"), message: "주제 다시 추천해줘", elementTarget: null, proposalTarget: null,
  });
  assert.equal(route.capability, "propose_topics");
  assert.equal(received[0].threadId, "thread-1");
  assert.match(received[0].input[0].type === "text" ? received[0].input[0].text : "", /주제 다시 추천해줘/);
  assert.equal(JSON.stringify(received[0].outputSchema).includes("propose_topics"), true);
  assert.equal(JSON.stringify(received[0].outputSchema).includes("add_image"), true);
  assert.equal(JSON.stringify(received[0].outputSchema).includes("duplicate_element"), true);
});

test("등록되지 않은 이미지 생성 동작은 채팅 권한으로 실행할 수 없다", async () => {
  const registry = new ContentJobRegistry({ createId: () => "job" });
  registry.add(input, "thread-1");
  const codex = { async runStructuredTurn() {
    return { status: "completed" as const, threadId: "thread-1", turnId: "turn-1",
      output: { capability: "generate_image", proposalSetId: "", candidateId: "", slideId: "" } };
  } };
  await assert.rejects(new CodexChatRouter(codex).route({
    job: registry.getRecord("job"), message: "이미지 생성해줘", elementTarget: null, proposalTarget: null,
  }), /채팅 동작을 결정하지 못했습니다/);
});
