import { useRef, useState, type DragEvent, type RefObject } from "react";
import { ArrowDown, ArrowUp, FileImage, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FormField } from "../form-field";

export function ReferenceImages({
  files,
  error,
  inputRef,
  onAddFiles,
  onRemoveFile,
  onMoveFile,
}: {
  files: File[];
  error: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onAddFiles: (list: FileList | null) => void;
  onRemoveFile: (index: number) => void;
  onMoveFile: (index: number, direction: -1 | 1) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  function enterDropZone(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function leaveDropZone(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  }

  function dropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    onAddFiles(event.dataTransfer.files);
  }

  return (
    <section className="grid gap-5 rounded-lg bg-surface-subtle p-6 max-md:p-4" aria-labelledby="reference-heading">
      <div className="grid gap-2">
        <h2 id="reference-heading" className="font-semibold">
          레퍼런스 슬라이드
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          분석할 게시물의 모든 슬라이드를 원래 순서대로 추가하세요.
        </p>
      </div>
      <FormField>
        <Label htmlFor="reference-images">이미지 추가</Label>
        <div
          className={cn(
            "grid min-h-44 place-items-center rounded-lg border border-dashed bg-background p-6 text-center transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            isDragging && "border-foreground bg-muted",
          )}
          onDragEnter={enterDropZone}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={leaveDropZone}
          onDrop={dropFiles}
        >
          <input
            ref={inputRef}
            id="reference-images"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="sr-only"
            aria-invalid={Boolean(error)}
            aria-describedby="reference-images-hint"
            onChange={(event) => {
              onAddFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="grid justify-items-center gap-3 pointer-events-none">
            <span className="grid size-11 place-items-center rounded-full border bg-background">
              <Upload className="size-5" aria-hidden="true" />
            </span>
            <div className="grid gap-1">
              <p className="text-sm font-medium">
                {isDragging
                  ? "이미지를 놓아서 추가하세요"
                  : "이미지를 여기로 드래그하세요"}
              </p>
              <p
                id="reference-images-hint"
                className="text-sm text-muted-foreground"
              >
                PNG, JPG, WebP · 최대 20장 · 장당 10MB
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="pointer-events-auto"
              onClick={() => inputRef.current?.click()}
            >
              파일 선택
            </Button>
          </div>
        </div>
      </FormField>
      {files.length > 0 && (
        <ol className="grid gap-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`} className="flex min-h-12 items-center gap-2 rounded-lg border bg-background px-3">
              <span className="w-6 text-sm tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <FileImage className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={index === 0}
                aria-label={`${file.name} 위로 이동`}
                onClick={() => onMoveFile(index, -1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={index === files.length - 1}
                aria-label={`${file.name} 아래로 이동`}
                onClick={() => onMoveFile(index, 1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`${file.name} 삭제`}
                onClick={() => onRemoveFile(index)}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
