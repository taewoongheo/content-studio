import assert from "node:assert/strict";
import test from "node:test";
import { contentJobEvents } from "./events";
import { ContentJobRegistry } from "../workflow/registry";

const input = { structure: "sequential" as const, aspectRatio: "9:16" as const, slideCount: 4, outputLanguage: "한국어" };

test("sends an immediate safe snapshot and subsequent job changes", async () => {
  const registry = new ContentJobRegistry({ createId: () => "job-1" });
  registry.add(input);
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
    job.editor.revision += 1;
  });
  assert.equal((await read()).editor.revision, 1);
  abort.abort();
  assert.equal((await reader.read()).done, true);
});

test("stops delivering updates after the consumer cancels", async () => {
  const registry = new ContentJobRegistry({ createId: () => "job-1" });
  registry.add(input);
  const controller = new AbortController();
  const reader = contentJobEvents(registry, "job-1", controller.signal).body!.getReader();

  await reader.cancel();
  assert.doesNotThrow(() => {
    registry.update("job-1", (job) => {
      job.editor.revision += 1;
    });
  });
});
