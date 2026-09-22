import type { RefObject } from "react";
import { ArrowDown, ArrowUp, FileImage, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
          className="grid gap-3 rounded-lg border border-dashed bg-background p-4 [&_input]:h-auto [&_input]:p-2"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            onAddFiles(event.dataTransfer.files);
          }}
        >
          <Input
            ref={inputRef}
            id="reference-images"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              onAddFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <p className="text-sm text-muted-foreground">
            PNG, JPG, WebP · 최대 20장 · 장당 10MB
          </p>
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
