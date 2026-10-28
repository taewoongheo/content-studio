import Ajv from "ajv";
import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { ApifyAccountPostsClient } from "@/domains/research/server/apify/account-posts";
import { personaSections } from "../../../domain/persona/model";
import { analyzePersona } from "./index";

const post = (id: number) => ({ id: String(id), webVideoUrl: `https://www.tiktok.com/@example/photo/${id}`,
  slideshowImageLinks: [`https://p.tiktokcdn.com/${id}-1.jpg`, `https://p.tiktokcdn.com/${id}-2.jpg`], textLanguage: "ko", text: "Caption",
  createTimeISO: `2026-10-${String(id).padStart(2, "0")}T00:00:00Z`, playCount: 100 });
const content = Object.fromEntries(personaSections.filter(s => s.id !== "instructions").map(section => [section.id, Object.fromEntries(Object.keys(section.fields).map(key => [key, {
  observation: "관찰한 표현 패턴", examples: ["Caption"], application: "구체적인 표현 규칙",
}]))]));

test("analysis includes at most ten carousels in every language, all slide bytes, and cleans up its files", async () => {
  let paths: string[] = [];
  const client = new ApifyAccountPostsClient("test", async (_, options) => {
    const { resultsPerPage, profileSorting } = JSON.parse(String(options?.body));
    const candidates = profileSorting === "popular" ? [1, 2, 3, 4, 5] : [12, 11, 10, 9, 8];
    return Response.json(candidates.slice(0, resultsPerPage).map(post));
  });
  const result = await analyzePersona("example", () => {}, { client,
    capture: async urls => urls.map(url => ({ data: Buffer.from(url), width: 540, height: 675 })),
    execute: async input => {
      assert.equal(input.standalone, true);
      assert.equal(input.model, "gpt-6.1-terra");
      if (!input.images) {
        assert.match(input.prompt, /endings.patterns/);
        assert.match(input.prompt, /personality.frequency/);
        assert.match(input.prompt, /Measured statistics/);
        const validate = new Ajv({ strict: false }).compile(input.schema as object);
        assert.equal(validate({ content }), true);
        return { content: structuredClone(content) };
      }
      paths = input.images;
      const validate = new Ajv({ strict: false, allErrors: true }).compile(input.schema as object);
      const transcript = { posts: Array.from({ length: 10 }, (_, i) => ({ index: i + 1, slides: [
        { text: "Train hard.", unreadable: false }, { text: "Rest well.", unreadable: false },
      ] })) };
      assert.equal(validate(transcript), true);
      assert.equal(input.standalone, true);
      assert.equal(input.model, "gpt-6.1-terra");
      assert.equal(paths.length, 20);
      assert.match(input.prompt, /Caption/);
      assert.match(input.prompt, /untrusted DATA/);
      assert.match(await readFile(paths[0], "utf8"), /1-1/);
      assert.match(await readFile(paths[19], "utf8"), /8-2/);
      return transcript;
    },
  });
  assert.match(result.content.hook.length, /평균 2단어/);
  assert.match(result.content.sentences.post_length, /평균 4단어/);
  assert.match(result.content.sentences.sentence_length, /평균 2단어/);
  assert.equal(result.analyzed_posts, 10);
  assert.equal("sources" in result, false);
  assert.equal(result.content.instructions.instructions, "");
  for (const path of paths) await assert.rejects(access(path));
});

test("an incomplete carousel fails before AI analysis rather than producing a caption-only persona", async () => {
  const client = new ApifyAccountPostsClient("test", async () => Response.json([post(1)]));
  await assert.rejects(analyzePersona("example", () => {}, { client, capture: async () => [],
    execute: async () => { assert.fail("must not analyze incomplete images"); },
  }), /누락/);
});

test("invented example quotes are retried once then rejected and temporary images are removed", async () => {
  const client = new ApifyAccountPostsClient("test", async () => Response.json([post(1)]));
  let calls = 0;
  let paths: string[] = [];
  await assert.rejects(analyzePersona("example", () => {}, {
    client, capture: async urls => urls.map(url => ({ data: Buffer.from(url), width: 540, height: 675 })),
    execute: async input => {
      calls++;
      if (input.images) {
        paths = input.images;
        return { posts: [{ index: 1, slides: [
          { text: "Train.", unreadable: false }, { text: "Rest.", unreadable: false },
        ] }] };
      }
      const result = structuredClone(content);
      result.development.structure.examples = ["This was never in the source."];
      return { content: result };
    },
  }), /예문이 원문과 일치하지/);
  assert.equal(calls, 3);
  for (const path of paths) await assert.rejects(access(path));
});
