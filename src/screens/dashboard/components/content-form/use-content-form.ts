import { useRef, useState, type FormEvent } from "react";
import type { ProductContext } from "../../hooks/use-product-context";
import {
  validateReference,
  validateReferenceImages,
} from "./reference-input/validation";
import {
  isImplementedWorkflow,
  type ContentType,
  type CreationMethod,
} from "./selection/model";
import type { ContentSettings } from "./settings/model";

export function useContentForm(context: ProductContext | null) {
  const [type, setType] = useState<ContentType>("slideshow");
  const [method, setMethod] = useState<CreationMethod>("reference");
  const [files, setFiles] = useState<File[]>([]);
  const [settings, setSettings] = useState<ContentSettings>({
    ratio: "9:16",
    count: "6장",
    language: "한국어",
  });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const referenceInput = useRef<HTMLInputElement>(null);
  const canCreate = isImplementedWorkflow(type, method);

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

  function changeSettings(patch: Partial<ContentSettings>) {
    setSettings((previous) => ({ ...previous, ...patch }));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const message = validateReferenceImages(files.length, incoming);
    if (message) {
      setFileError(message);
      return;
    }
    setFiles((previous) => [...previous, ...incoming]);
    setFileError("");
    setError("");
  }

  function removeFile(index: number) {
    setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveFile(index: number, direction: -1 | 1) {
    setFiles((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const reordered = [...previous];
      [reordered[index], reordered[target]] = [
        reordered[target],
        reordered[index],
      ];
      return reordered;
    });
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !canCreate) return;
    const message = validateReference(files);
    setError(message);
    if (message) {
      referenceInput.current?.focus();
      return;
    }
    setReviewOpen(true);
  }

  return {
    type,
    method,
    canCreate,
    files,
    settings,
    reviewOpen,
    error,
    fileError,
    referenceInput,
    changeType,
    changeMethod,
    changeSettings,
    addFiles,
    removeFile,
    moveFile,
    review,
    setReviewOpen,
  };
}
