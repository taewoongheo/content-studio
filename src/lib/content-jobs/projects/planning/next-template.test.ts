import assert from "node:assert/strict";
import test from "node:test";
import { nextTemplateInLoop } from "./next-template";

const templates = [{ id: "a", templateOrder: 1 }, { id: "b", templateOrder: 2 }];
const post = (id: string, sourceTemplateProjectId: string | null, publishedAt: string | null) =>
  ({ id, sourceTemplateProjectId, publishedAt });

test("다음 템플릿은 활성 루프 순서를 따르고 게시 이력이 없으면 처음부터 시작한다", () => {
  assert.equal(nextTemplateInLoop([], []), null);
  assert.equal(nextTemplateInLoop([{ id: "excluded", templateOrder: null }], []), null);
  assert.equal(nextTemplateInLoop([...templates].reverse(), [])?.id, "a");
  assert.equal(nextTemplateInLoop(templates, [post("draft", "b", null)])?.id, "a");
  assert.equal(nextTemplateInLoop(templates, [post("child", "a", "2026-10-15")])?.id, "b");
  assert.equal(nextTemplateInLoop(templates, [post("b", null, "2026-10-15")])?.id, "a");
});

test("게시 시각이 같으면 목록 순서와 무관하게 DB와 동일한 ID 내림차순으로 선택한다", () => {
  const projects = [post("post-a", "a", "2026-10-15"), post("post-z", "b", "2026-10-15")];
  assert.equal(nextTemplateInLoop(templates, projects)?.id, "a");
  assert.equal(nextTemplateInLoop(templates, projects.reverse())?.id, "a");
});

test("제외·부모 변경·루프 재정렬은 현재 연결 기준으로 다음 템플릿에 반영한다", () => {
  const projects = [post("old", "a", "2026-10-14"), post("new", "excluded", "2026-10-15")];
  assert.equal(nextTemplateInLoop(templates, projects)?.id, "b");
  assert.equal(nextTemplateInLoop(templates, [...projects, post("moved", "b", "2026-10-16")])?.id, "a");
  const reordered = [{ id: "b", templateOrder: 1 }, { id: "a", templateOrder: 2 }, { id: "c", templateOrder: 3 }];
  assert.equal(nextTemplateInLoop(reordered, projects)?.id, "c");
  assert.deepEqual(templates.map(template => template.id), ["a", "b"]);
});
