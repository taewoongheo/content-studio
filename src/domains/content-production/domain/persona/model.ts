import { z } from "zod";

export const personaSections = [
  { id: "profile", label: "프로필 컨셉", fields: { concept: "프로필 컨셉" } },
  { id: "audience", label: "타겟 오디언스", fields: { demographics: "인구통계 프로필", motivation: "팔로우 동기", needs: "오디언스 니즈", promise: "암묵적 약속" } },
  { id: "hook", label: "Hook · 관심 유도", fields: { patterns: "주요 패턴 · 빈도 · 예시", tone: "훅 톤", techniques: "주목할 기법", length: "평균 훅 길이" } },
  { id: "titles", label: "글쓰기 스타일 · 제목 형식", fields: { patterns: "제목 형식 · 예시" } },
  { id: "sentences", label: "글쓰기 스타일 · 문장 구조", fields: { post_length: "평균 게시물 길이", sentence_length: "평균 문장 길이", paragraphs: "단락 구성", line_breaks: "줄바꿈 패턴", conjunctions: "접속사 사용" } },
  { id: "development", label: "글쓰기 스타일 · 글 전개 방식", fields: { structure: "주요 구조", contrast: "대조/반전 활용", conclusion: "결론 스타일" } },
  { id: "endings", label: "글쓰기 스타일 · 어미 패턴", fields: { patterns: "주요 어미 · 빈도 · 예시", formality: "격식/비격식 비율", rules: "상황별 규칙" } },
  { id: "relationship", label: "글쓰기 스타일 · 감정적 거리", fields: { relationship: "독자와의 관계", confidence: "자신감 수준", disclosure: "자기 노출 수준" } },
  { id: "personality", label: "글쓰기 스타일 · 유머와 개성", fields: { frequency: "유머 빈도", humor: "유머 유형", traits: "개성적 특징" } },
  { id: "cta", label: "CTA · 행동 유도", fields: { types: "유형별 목적 · 설명 · 예시" } },
  { id: "links", label: "레퍼런스 링크 공유", fields: { rules: "링크 공유 방식 · 예시" } },
  { id: "instructions", label: "추가 지시사항", fields: { instructions: "추가 지시사항" } },
] as const;

export const personaContentSchema = z.object(Object.fromEntries(personaSections.map(section => [
  section.id, z.object(Object.fromEntries(Object.keys(section.fields).map(key => [key, z.string().max(12000)]))).strict(),
]))).strict();
export type PersonaContent = Record<string, Record<string, string>>;
export const personaSettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  output_language: z.string().trim().min(1).max(80),
  content: personaContentSchema,
}).strict();
export type PersonaSettings = z.infer<typeof personaSettingsSchema>;
export interface Persona extends PersonaSettings {
  handle: string;
  revision: number;
  analyzed_at: string;
  updated_at: string;
  analyzed_posts: number;
}
export interface PersonaJob {
  state: "idle" | "running" | "completed" | "failed";
  message: string;
  error: string | null;
}
export interface PersonaResponse { persona: Persona | null; job: PersonaJob }
