import { z } from "zod";

export const transcriptSchema = z.object({
  posts: z.array(z.object({
    index: z.number().int().positive(),
    slides: z.array(z.object({
      text: z.string().max(16000).describe("이 슬라이드의 모든 문구를 원문 그대로 읽기 순서와 줄바꿈을 유지하여 전사한다. 요약 금지."),
      unreadable: z.boolean().describe("문구 일부라도 읽을 수 없어 생략하거나 추측해야 하는 경우 true."),
    }).strict()).min(1),
  }).strict()).min(1).max(10),
}).strict();
export type Transcript = z.infer<typeof transcriptSchema>;
export type PostInput = { caption: string; slides: number; first_image: number; last_image: number; selection_group: string; published_at: string | null; view_count: number | null };

export function validateTranscript(transcript: Transcript, mapping: Pick<PostInput, "slides">[]) {
  if (transcript.posts.length !== mapping.length) throw new Error("문구 추출에서 게시물이 누락되었습니다.");
  transcript.posts.forEach((post, i) => {
    if (post.index !== i + 1 || post.slides.length !== mapping[i].slides) throw new Error("문구 추출에서 슬라이드 순서 또는 장수가 일치하지 않습니다.");

  });
  if (!transcript.posts.some(p => p.slides.some(s => !s.unreadable && s.text.trim()))) throw new Error("분석할 수 있는 슬라이드 문구가 없습니다.");
}

const words = new Intl.Segmenter("en", { granularity: "word" });
const sentences = new Intl.Segmenter("en", { granularity: "sentence" });
const count = (text: string) => ({
  words: [...words.segment(text)].filter(s => s.isWordLike).length,
  characters: [...text.trim()].length,
});
const average = (texts: string[]) => {
  const counts = texts.map(count);
  const mean = (key: "words" | "characters") => counts.length ? Math.round(counts.reduce((sum, c) => sum + c[key], 0) / counts.length * 10) / 10 : 0;
  return { samples: counts.length, words: mean("words"), characters: mean("characters") };
};
export function transcriptMetrics(transcript: Transcript, captions: string[]) {
  const completePosts = transcript.posts.filter(p => p.slides.every(s => !s.unreadable));
  const slideTexts = completePosts.map(p => p.slides.map(s => s.text).join("\n\n"));
  const readableSlides = transcript.posts.flatMap(p => p.slides.filter(s => !s.unreadable).map(s => s.text));
  const units = (texts: string[]) => texts.flatMap(t => t.split(/\n+/).flatMap(line =>
    [...sentences.segment(line)].map(s => s.segment.trim()).filter(Boolean)));
  return {
    hook: average(transcript.posts.filter(p => !p.slides[0].unreadable).map(p => p.slides[0].text)),
    slide_post: average(slideTexts),
    caption_post: average(captions),
    slide_sentence: average(units(readableSlides)),
    caption_sentence: average(units(captions)),
    unreadable_slides: transcript.posts.reduce((n, p) => n + p.slides.filter(s => s.unreadable).length, 0),
    method: "판독 불완전한 슬라이드는 길이 집계에서 제외하고 게시물 길이는 모든 장이 판독된 게시물만 사용한다. 단어는 단어 경계 기준, 글자는 공백·문장부호 포함 Unicode 문자 수. 문장 길이는 줄바꿈 및 문장 경계로 분리한 텍스트 단위(제목·단편 포함). 표지 훅은 첫 장 전체 문구. 캡션은 해시태그 포함.",
  };
}
export function measuredFields(metrics: ReturnType<typeof transcriptMetrics>) {
  const format = (v: ReturnType<typeof average>) => v.samples === 0 ? "확인 불가" : `평균 ${v.words}단어 / ${v.characters}자`;
  return {
    hook: format(metrics.hook),
    post: "슬라이드 전체 문구: " + format(metrics.slide_post) + "\n캡션: " + format(metrics.caption_post),
    sentence: "슬라이드 텍스트 단위: " + format(metrics.slide_sentence) + "\n캡션 텍스트 단위: " + format(metrics.caption_sentence),
  };
}
