"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { selectUploadImage } from "@/lib/image-upload";

export function useChatAttachment(disabled: boolean) {
  const [attachment, setAttachment] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!attachment) return;
    return () => URL.revokeObjectURL(attachment.url);
  }, [attachment]);

  function clear() {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function receive(files: ArrayLike<File> | null) {
    const result = selectUploadImage(files);
    if (!result.file) { setError(result.error); return; }
    setError("");
    setAttachment({ file: result.file, url: URL.createObjectURL(result.file) });
  }

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    if (disabled || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!disabled && event.dataTransfer.types.includes("Files")) event.preventDefault();
  }

  function onDragLeave() {
    if (dragDepth.current === 0) return;
    dragDepth.current -= 1;
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!disabled) receive(event.dataTransfer.files);
  }

  return { attachment, error, dragging, fileInputRef, receive, clear,
    dragHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
