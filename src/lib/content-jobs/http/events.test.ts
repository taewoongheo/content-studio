import assert from "node:assert/strict";
import test from "node:test";
import { contentJobEvents } from "./events";
import { ContentJobRegistry } from "../workflow/registry";

const input = {
  model: "gpt-6-luna",
  productContext: {
    name: "제품",
    description: "설명",
    audience: "대상",
    constraints: "",
  },
  aspectRatio: "9:16" as const,
  slideCount: 4,
  outputLanguage: "한국어",
  referenceImages: [
    {
      id: "image-1",
      name: "one.png",
      path: "/private/reference.png",
      type: "image/png" as const,
      size: 8,
    },
  ],
};

test("sends an immediate safe snapshot and subsequent job changes", async () => {
  const registry = new ContentJobRegistry({ createId: () => "job-1" });
  registry.add(input, "private-thread-id");
  const abort = new AbortController();
  const reader = contentJobEvents(registry, "job-1", abort.signal).body!.getReader();
  const read = async () => {
    const result = await reader.read();
    return JSON.parse(new TextDecoder().decode(result.value).slice(6));
  };

  const initial = await read();
  assert.equal(initial.id, "job-1");
  assert.equal(JSON.stringify(initial).includes("private-thread-id"), false);
  assert.equal(JSON.stringify(initial).includes("/private/reference.png"), false);

  registry.update("job-1", (job) => {
    job.lastError = "다시 시도하세요.";
  });
  assert.equal((await read()).lastError, "다시 시도하세요.");
  abort.abort();
  assert.equal((await reader.read()).done, true);
});
