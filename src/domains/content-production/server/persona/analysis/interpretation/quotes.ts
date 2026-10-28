import type { z } from "zod";
import type { synthesisSchema } from "./questions";
import type { PersonaEvidence } from "./transcript";

function normalizeQuote(text: string) {
  return text.replaceAll("\\n", "\n").replace(/\s+/g, " ").trim();
}

function inlineQuotes(text: string) {
  return [...text.matchAll(/“([^”]+)”/g)].map(match => match[1]);
}

// Validate examples and inline quotations against the original extracted text.
export function invalidExampleFields(result: z.infer<typeof synthesisSchema>, evidence: PersonaEvidence) {
  const corpus = evidence.flatMap(post => [post.caption, ...post.slides.map(slide => slide.text)]).map(normalizeQuote);
  return Object.entries(result.content).flatMap(([section, fields]) =>
    Object.entries(fields).flatMap(([key, field]) => {
      const examples = [...field.examples, ...inlineQuotes(field.observation), ...inlineQuotes(field.application)];
      return examples.filter(example => !corpus.some(text => text.includes(normalizeQuote(example))))
        .map(() => section + "." + key);
    }));
}
