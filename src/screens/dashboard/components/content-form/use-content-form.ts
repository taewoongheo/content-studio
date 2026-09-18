import { useRef, useState, type FormEvent } from "react";
import type { ProductContext } from "../../hooks/use-product-context";
import {
  templates,
  type ContentType,
  type Method,
  type Materials,
  type ContentSettings,
} from "./model";
import { validateMaterials, validateReferenceImages } from "./validation";

export function useContentForm(context: ProductContext | null) {
  const [type, setType] = useState<ContentType>("slideshow");
  const [method, setMethod] = useState<Method>("reference");
  const [materials, setMaterials] = useState<Materials>({
    reference: "",
    referenceText: "",
    files: [],
    template: templates[0],
    notes: "",
  });
  const [settings, setSettings] = useState<ContentSettings>({
    ratio: "4:5",
    count: "6장",
    videoRatio: "9:16",
    duration: "30초",
    channel: "SNS 게시글",
    length: "보통 · 약 500자",
    language: "한국어",
  });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const referenceInput = useRef<HTMLInputElement>(null);

  function changeType(value: ContentType) {
    setType(value);
    setError("");
    setFileError("");
  }

  function changeMethod(value: Method) {
    setMethod(value);
    setError("");
  }

  function changeMaterials(patch: Partial<Materials>) {
    setMaterials((previous) => ({ ...previous, ...patch }));
    if (patch.reference !== undefined || patch.referenceText !== undefined) {
      setError("");
    }
  }

  function changeSettings(patch: Partial<ContentSettings>) {
    setSettings((previous) => ({ ...previous, ...patch }));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const message = validateReferenceImages(materials.files.length, incoming);
    if (message) {
      setFileError(message);
      return;
    }
    setMaterials((previous) => ({
      ...previous,
      files: [...previous.files, ...incoming],
    }));
    setFileError("");
    setError("");
  }

  function removeFile(index: number) {
    setMaterials((previous) => ({
      ...previous,
      files: previous.files.filter((_, i) => i !== index),
    }));
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) return;
    const message = validateMaterials(type, method, materials);
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
    materials,
    settings,
    reviewOpen,
    error,
    fileError,
    referenceInput,
    changeType,
    changeMethod,
    changeMaterials,
    changeSettings,
    addFiles,
    removeFile,
    review,
    setReviewOpen,
  };
}
