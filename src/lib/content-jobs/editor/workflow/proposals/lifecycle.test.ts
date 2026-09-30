import assert from "node:assert/strict";
import test from "node:test";
import { isProposalInteractive } from "./lifecycle";
import type { EditorJobState, EditorProposalSet } from "../../types";

const set: EditorProposalSet = { id: "set", kind: "topic", version: 1, messageId: "proposal",
  stale: false, items: [{ id: "candidate", title: "주제", angle: "방향", rationale: "이유", sourceUrls: [] }] };
const state = (messages: EditorJobState["messages"]) => ({ messages } as EditorJobState);

test("제안은 다음 사용자 메시지 전까지만 선택할 수 있다", () => {
  assert.equal(isProposalInteractive(state([{ id: "proposal", role: "assistant", text: "제안" }]), set), true);
  assert.equal(isProposalInteractive(state([
    { id: "proposal", role: "assistant", text: "제안" },
    { id: "next", role: "user", text: "다른 방향으로" },
  ]), set), false);
});

test("선택한 후보를 전달했어도 과거 카드가 다시 활성화되지 않는다", () => {
  const editor = state([
    { id: "proposal", role: "assistant", text: "제안" },
    { id: "next", role: "user", text: "짧게", proposalTarget: { setId: "set", candidateId: "candidate" } },
    { id: "reply", role: "assistant", text: "수정" },
  ]);
  assert.equal(isProposalInteractive(editor, set), false);
  assert.equal(isProposalInteractive(editor, { ...set, id: "revised", messageId: "reply" }), true);
  assert.equal(isProposalInteractive(editor, { ...set, messageId: "reply", stale: true }), false);
});
