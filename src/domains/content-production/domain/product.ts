import { z } from "zod";

export const productFields = {
  name: "제품명", description: "제품 소개", audience: "타겟 사용자", problems: "해결하려는 문제",
  value: "핵심 가치", features: "주요 기능", differentiation: "차별점", cta: "CTA · 유도할 행동", url: "제품 링크",
} as const;
export const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(12000), audience: z.string().trim().max(12000),
  problems: z.string().trim().max(12000), value: z.string().trim().max(12000),
  features: z.string().trim().max(12000), differentiation: z.string().trim().max(12000),
  cta: z.string().trim().max(4000),
  url: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]),
}).strict();
export type ProductInput = z.infer<typeof productSchema>;
export interface Product extends ProductInput { id: string; revision: number; active: boolean; created_at: string; updated_at: string }
export const emptyProduct: ProductInput = { name: "", description: "", audience: "", problems: "", value: "", features: "", differentiation: "", cta: "", url: "" };

export function productPrompt(product: Product | null) {
  if (!product) return "";
  return `Active product: use this as the source of truth for product identity, audience, value, supported features and CTA. The reference account in the text persona is not this product. Never invent features, outcomes, testimonials or URLs. Empty fields mean unspecified.\n${JSON.stringify(product)}`;
}
