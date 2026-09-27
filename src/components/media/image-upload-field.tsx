"use client";

import { useRef, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selectUploadImage } from "@/lib/image-upload";

type ImageUploadFieldProps = {
  id: string;
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
};

export function ImageUploadField({ id, label, file, onFileChange, disabled = false }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  function receiveFiles(files: ArrayLike<File> | null) {
    const result = selectUploadImage(files);
    setError(result.error ?? "");
    onFileChange(result.file);
  }

  function enter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function leave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!disabled) receiveFiles(event.dataTransfer.files);
  }

  return <div className="grid gap-1.5 text-sm">
    <label htmlFor={id} className="font-medium">{label}</label>
    <div onDragEnter={enter} onDragLeave={leave} onDragOver={(event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    }} onDrop={drop}
      className={`grid min-h-36 justify-items-center gap-2 rounded-lg border border-dashed bg-background p-5 text-center transition-colors ${dragging ? "border-foreground bg-muted" : "border-input"}`}>
      <input ref={inputRef} id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
        aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} disabled={disabled}
        onChange={(event) => {
          if (event.target.files?.length) receiveFiles(event.target.files);
          event.target.value = "";
        }} />
      <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="min-w-0 max-w-full break-all font-medium">{dragging ? "여기에 놓으세요" : file?.name ?? "이미지를 여기에 드래그하세요"}</p>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">PNG, JPG, WebP · 10MB 이하</p>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
        {file ? "이미지 변경" : "파일 선택"}
      </Button>
    </div>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
