import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { ApifyAccountPostsClient } from "@/domains/research/server/apify/account-posts";
import { capturePersonaSlides } from "./images";
import { runCodex } from "../../execution/process";
import { type Persona } from "../../../domain/persona/model";

import { selectPersonaPosts } from "./selection";
import { transcriptionPrompt, synthesisPrompt, repairPrompt } from "./interpretation/prompts";
import { invalidExampleFields } from "./interpretation/quotes";
import { renderAnalysis, synthesisSchema } from "./interpretation/questions";
import { measuredFields, transcriptMetrics, transcriptSchema, validateTranscript, type PostInput } from "./interpretation/transcript";

export async function analyzePersona(handle: string, progress: (message: string) => void,
  services = { client: new ApifyAccountPostsClient(), capture: capturePersonaSlides, execute: runCodex }) {
  const signal = AbortSignal.timeout(15 * 60_000);
  const posts = await selectPersonaPosts(handle, signal, services.client, progress);
  if (!posts.length) throw new Error("분석 가능한 슬라이드쇼를 찾지 못했습니다.");
  const directory = await mkdtemp(join(tmpdir(), "content-persona-"));
  try {
    const images: string[] = [];
    const mapping: PostInput[] = [];
    for (const [index, { post, group }] of posts.entries()) {
      signal.throwIfAborted();
      progress(`슬라이드 이미지 준비 중 · ${index + 1}/${posts.length}`);
      // All slides must be available. A partial carousel must not silently become analysis evidence.
      const slides = await services.capture(post.images);
      if (slides.length !== post.images.length) throw new Error("일부 슬라이드 이미지가 누락되었습니다. 다시 분석해 주세요.");
      const first = images.length + 1;
      for (const [slideIndex, slide] of slides.entries()) {
        const path = join(directory, `${index + 1}-${slideIndex + 1}.png`);
        await writeFile(path, slide.data);
        images.push(path);
      }
      const item = { caption: post.caption, published_at: post.published_at,
        view_count: post.view_count, slides: slides.length, selection_group: group };
      mapping.push({ ...item, first_image: first, last_image: images.length });
    }
    const execute = (schema: z.ZodType, prompt: string, attachedImages?: string[]) => services.execute({
      standalone: true, model: "gpt-6.1-terra", images: attachedImages, signal, origin: "", taskId: "", token: "", onActivity() {},
      schema: z.toJSONSchema(schema, { target: "draft-7" }), prompt,
    });
    progress(`전체 슬라이드 문구 추출 중 · ${posts.length}개 게시물 / ${images.length}장`);
    const transcript = transcriptSchema.parse(await execute(transcriptSchema, transcriptionPrompt(mapping), images));
    for (const post of transcript.posts) for (const slide of post.slides) slide.text = slide.text.replaceAll("\\n", "\n");
    validateTranscript(transcript, mapping);
    const metrics = transcriptMetrics(transcript, mapping.map(p => p.caption));
    const evidence = transcript.posts.map((post, i) => ({ ...post, caption: mapping[i].caption, selection_group: mapping[i].selection_group, published_at: mapping[i].published_at }));
    progress("세부 항목별 표현 패턴 분석 중 · 문장 구조·전개·어미·CTA");
    const prompt = synthesisPrompt(handle, metrics, evidence);
    let result = synthesisSchema.parse(await execute(synthesisSchema, prompt));
    let invalid = invalidExampleFields(result, evidence);
    if (invalid.length) {
      progress("분석 예문 검증 및 보정 중");
      result = synthesisSchema.parse(await execute(synthesisSchema, repairPrompt(prompt, invalid, result)));
      invalid = invalidExampleFields(result, evidence);
      if (invalid.length) throw new Error("분석 예문이 원문과 일치하지 않습니다. 기존 페르소나를 유지합니다.");
    }
    const content = renderAnalysis(result);
    const measured = measuredFields(metrics);
    content.hook.length = measured.hook;
    content.sentences.post_length = measured.post;
    content.sentences.sentence_length = measured.sentence;
    const now = new Date().toISOString();
    return { handle, name: `@${handle}`, output_language: "English", content, analyzed_at: now, updated_at: now, analyzed_posts: posts.length } satisfies Omit<Persona, "revision">;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
