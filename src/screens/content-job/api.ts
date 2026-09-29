import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import type { SlideshowStructure } from "@/lib/content-jobs/domain/types";
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
  model,
  context,
  referenceImages,
  structure,
  aspectRatio,
  outputLanguage,
}: {
  model: string;
  context: ProductContext;
  referenceImages: File[];
  structure: SlideshowStructure;
  aspectRatio: "4:5" | "1:1" | "9:16";
  outputLanguage: string;
}) {
  const form = new FormData();
  form.set("model", model);
  form.set("structure", structure);
  form.set("productContext", JSON.stringify(context));
  form.set("aspectRatio", aspectRatio);
  form.set("outputLanguage", outputLanguage);
  for (const file of referenceImages) {
    form.append("images", file);
  }
  const created = await readResponse(
    await fetch("/api/content-jobs", { method: "POST", body: form }),
  );
  return postContentJobAction(created.id, { action: "initialize_editor" });
}

export async function postContentJobAction(
  jobId: string,
  body: Record<string, unknown>,
) {
  if (body.action === "chat_edit" && Array.isArray(body.images) && body.images.length > 0) {
    const form = new FormData();
    form.set("action", "chat_edit");
    form.set("expectedRevision", String(body.expectedRevision));
    form.set("message", String(body.message));
    if (body.target) form.set("target", JSON.stringify(body.target));
    if (body.proposalTarget) form.set("proposalTarget", JSON.stringify(body.proposalTarget));
    for (const image of body.images) form.append("images", image);
    return readResponse(await fetch(`/api/content-jobs/${encodeURIComponent(jobId)}`, {
      method: "POST", body: form,
    }));
  }
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

export async function uploadEditorImage(jobId: string, image: File) {
  const form = new FormData();
  form.set("image", image);
  return readResponse(await fetch(`/api/content-jobs/${encodeURIComponent(jobId)}/assets`, {
    method: "POST",
    body: form,
  }));
}

export async function attachStoredEditorImage(jobId: string, assetId: string) {
  return readResponse(await fetch(`/api/content-jobs/${encodeURIComponent(jobId)}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId }),
  }));
}
