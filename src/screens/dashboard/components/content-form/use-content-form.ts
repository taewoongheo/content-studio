import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ProductContext } from "../../hooks/use-product-context";
import {
  validateReference,
  validateReferenceImages,
} from "./reference-input/validation";
import {
  createReferenceImageDrafts,
  reorderReferenceImages,
  type ReferenceImageDraft,
} from "./reference-input/reference-images-model";
import {
  DEFAULT_SLIDESHOW_STRUCTURE,
  isImplementedWorkflow,
  type ContentType,
  type CreationMethod,
  type SlideshowStructure,
} from "./selection/model";
import { DEFAULT_CONTENT_SETTINGS, type ContentSettings } from "./settings/model";

export function useContentForm(context: ProductContext | null) {
  const [type, setType] = useState<ContentType>("slideshow");
  const [structure, setStructure] = useState<SlideshowStructure>(DEFAULT_SLIDESHOW_STRUCTURE);
  const [method, setMethod] = useState<CreationMethod>("reference");
  const [referenceImages, setReferenceImages] = useState<
    ReferenceImageDraft[]
  >([]);
  const [settings, setSettings] = useState<ContentSettings>(DEFAULT_CONTENT_SETTINGS);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const referenceInput = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());
  const canCreate = isImplementedWorkflow(type, method, structure);
  const files = referenceImages.map((image) => image.file);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  function changeType(nextType: ContentType) {
    setType(nextType);
    setError("");
    setFileError("");
    setReviewOpen(false);
  }

  function changeMethod(nextMethod: CreationMethod) {
    setMethod(nextMethod);
    setError("");
    setFileError("");
    setReviewOpen(false);
  }

  function changeStructure(nextStructure: SlideshowStructure) {
    setStructure(nextStructure);
    setError("");
    setFileError("");
    setReviewOpen(false);
  }

  function changeSettings(patch: Partial<ContentSettings>) {
    setSettings((previous) => ({ ...previous, ...patch }));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const message = validateReferenceImages(referenceImages.length, incoming);
    if (message) {
      setFileError(message);
      return;
    }
    const drafts = createReferenceImageDrafts(incoming);
    for (const draft of drafts) previewUrls.current.add(draft.previewUrl);
    setReferenceImages((previous) => [...previous, ...drafts]);
    setFileError("");
    setError("");
  }

  function removeImage(id: string) {
    const removed = referenceImages.find((image) => image.id === id);
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
      previewUrls.current.delete(removed.previewUrl);
    }
    setReferenceImages((previous) =>
      previous.filter((image) => image.id !== id),
    );
  }

  function reorderImages(activeId: string, overId: string) {
    setReferenceImages((previous) =>
      reorderReferenceImages(previous, activeId, overId),
    );
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !canCreate) return;
    const message = validateReference(files, structure);
    setError(message);
    if (message) {
      referenceInput.current?.focus();
      return;
    }
    setReviewOpen(true);
  }

  return {
    type,
    structure,
    method,
    canCreate,
    referenceImages,
    files,
    settings,
    reviewOpen,
    error,
    fileError,
    referenceInput,
    changeType,
    changeStructure,
    changeMethod,
    changeSettings,
    addFiles,
    removeImage,
    reorderImages,
    review,
    setReviewOpen,
  };
}
