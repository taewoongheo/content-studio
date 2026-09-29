"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { selectChatUploadImages } from "@/lib/image-upload";

export function useChatAttachment(disabled: boolean) {
  const [attachments, setAttachments] = useState<Array<{ file: File; url: string }>>([]);
  const urls = useRef(new Set<string>());
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const createdUrls = urls.current;
    return () => { for (const url of createdUrls) URL.revokeObjectURL(url); };
  }, []);

  function clear() {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function remove(url: string) {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
    setAttachments((current) => current.filter((item) => item.url !== url));
  }

  function receive(files: ArrayLike<File> | null) {
    const result = selectChatUploadImages(attachments.map((item) => item.file), files);
    if (!result.files) { setError(result.error); return; }
    setError("");
    const additions = result.files.slice(attachments.length).map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      return { file, url };
    });
    setAttachments((current) => [...current, ...additions]);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  return { attachments, error, dragging, fileInputRef, receive, clear, remove,
    dragHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
