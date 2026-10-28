import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { analysisQuestions, synthesisSchema } from "./questions";
import { transcriptMetrics, validateTranscript } from "./transcript";

test("all output fields carry their actual questions and structured observation/example/application contracts", () => {
  const schema = JSON.stringify(z.toJSONSchema(synthesisSchema, { target: "draft-7" }));
  assert.match(schema, /게시물 끝이 아니라 각 문장의 종결 방식/);
  assert.match(schema, /유머가 나타난 게시물 수/);
  assert.match(schema, /페이지 목록이 아니라 논리/);
  assert.match(analysisQuestions(), /development.contrast/);
  assert.match(analysisQuestions(), /단순 제품 소개와 명시적 행동 요청/);
  assert.equal(synthesisSchema.safeParse({ content: { endings: { patterns: "광고로 끝남" } } }).success, false);
});

test("transcripts require every post and slide in order and reject wholly unusable text", () => {
  const transcript = { posts: [{ index: 1, slides: [{ text: "Train hard.", unreadable: false }] }] };
  validateTranscript(transcript, [{ slides: 1 }]);
  assert.throws(() => validateTranscript(transcript, [{ slides: 2 }]), /장수/);
  assert.throws(() => validateTranscript(transcript, [{ slides: 1 }, { slides: 1 }]), /누락/);
  assert.throws(() => validateTranscript({ posts: [{ ...transcript.posts[0], index: 2 }] }, [{ slides: 1 }]), /순서/);
  assert.throws(() => validateTranscript({ posts: [{ index: 1, slides: [{ text: "", unreadable: true }] }] }, [{ slides: 1 }]), /분석할 수 있는/);
});

test("lengths are computed separately for full slide copy, cover copy, and captions", () => {
  const metrics = transcriptMetrics({ posts: [
    { index: 1, slides: [{ text: "Train hard.", unreadable: false }, { text: "Rest well.\nRepeat.", unreadable: false }] },
    { index: 2, slides: [{ text: "Rest.", unreadable: false }] },
  ] }, ["Try this now!", ""]);
  assert.equal(metrics.hook.words, 1.5);
  assert.equal(metrics.slide_post.words, 3);
  assert.equal(metrics.caption_post.words, 1.5);
  assert.equal(metrics.slide_sentence.samples, 4);
  assert.equal(metrics.slide_sentence.words, 1.5);
});

test("partially illegible slides remain explicit but cannot distort measured averages", () => {
  const transcript = { posts: [{ index: 1, slides: [
    { text: "Train hard.", unreadable: false },
    { text: "Some [판독 불가]", unreadable: true },
  ] }] };
  validateTranscript(transcript, [{ slides: 2 }]);
  const metrics = transcriptMetrics(transcript, ["Try it."]);
  assert.equal(metrics.unreadable_slides, 1);
  assert.equal(metrics.slide_post.samples, 0);
  assert.equal(metrics.hook.words, 2);
  assert.equal(metrics.slide_sentence.words, 2);
});
