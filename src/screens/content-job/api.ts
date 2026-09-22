import type { ContentJobSnapshot } from "@/lib/content-jobs/types";
import type { ProductContext } from "@/screens/dashboard/hooks/use-product-context";

async function readResponse(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      typeof (body as Record<string, unknown>).error === "string"
        ? String((body as Record<string, unknown>).error)
        : "요청을 처리하지 못했습니다.";
    throw new Error(message);
  }
  return body as ContentJobSnapshot;
}

export async function createContentJob({
  context,
  files,
  aspectRatio,
  slideCount,
  outputLanguage,
}: {
  context: ProductContext;
  files: File[];
  aspectRatio: "4:5" | "1:1" | "9:16";
  slideCount: number;
  outputLanguage: string;
}) {
  const form = new FormData();
  form.set("productContext", JSON.stringify(context));
  form.set("aspectRatio", aspectRatio);
  form.set("slideCount", String(slideCount));
  form.set("outputLanguage", outputLanguage);
  for (const file of files) form.append("images", file);
  const created = await readResponse(
    await fetch("/api/content-jobs", { method: "POST", body: form }),
  );
  return postContentJobAction(created.id, { action: "analyze_reference" });
}

export async function postContentJobAction(
  jobId: string,
  body: Record<string, unknown>,
) {
  return readResponse(
    await fetch(`/api/content-jobs/${encodeURIComponent(jobId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function getContentJob(jobId: string) {
  return readResponse(
    await fetch(`/api/content-jobs/${encodeURIComponent(jobId)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
  );
}
