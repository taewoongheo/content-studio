import { FormField } from "./form-field";
import { FileImage, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReferenceImages({
  files,
  error,
  onAddFiles,
  onRemoveFile,
}: {
  files: File[];
  error: string;
  onAddFiles: (list: FileList | null) => void;
  onRemoveFile: (index: number) => void;
}) {
  return (
    <>
      <FormField>
        <Label htmlFor="reference-images">또는 레퍼런스 이미지</Label>
        <div
          className={
            "grid gap-4 rounded-lg border border-dashed p-4 [&_input]:h-auto [&_input]:p-2"
          }
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            onAddFiles(event.dataTransfer.files);
          }}
        >
          <Input
            id="reference-images"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(event) => {
              onAddFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <p className="text-sm text-muted-foreground">
            파일을 선택하거나 여기에 끌어놓으세요. PNG, JPG, WebP · 최대 5장 ·
            장당 10MB
          </p>
        </div>
      </FormField>
      {files.length > 0 && (
        <ul
          className={
            "grid gap-2 [&_li]:flex [&_li]:items-center [&_li]:gap-2.5 [&_li]:rounded-lg [&_li]:border [&_li]:px-2 [&_li]:py-1 [&_li>span]:min-w-0 [&_li>span]:flex-1 [&_li>span]:text-sm [&_li>span]:wrap-anywhere"
          }
        >
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <FileImage aria-hidden="true" className="size-4" />
              <span>{file.name}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-11"
                aria-label={`${file.name} 삭제`}
                onClick={() => onRemoveFile(index)}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p
          role="alert"
          className={"my-2 text-sm leading-relaxed text-destructive"}
        >
          {error}
        </p>
      )}
    </>
  );
}
