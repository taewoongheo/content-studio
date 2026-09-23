import { Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  REFERENCE_ROLES,
  type ReferenceRole,
} from "@/lib/content-jobs/domain/types";
import { cn } from "@/lib/utils";
import type { ReferenceImageDraft } from "../reference-images-model";

const roleDetails: Record<ReferenceRole, { title: string; description: string }> = {
  hook: {
    title: "훅",
    description: "첫 장의 시각 구성과 시선을 끄는 문구",
  },
  body: {
    title: "반복 본문",
    description: "가운데 장들에서 반복할 대표 포맷",
  },
  cta: {
    title: "CTA",
    description: "마지막 장의 마무리와 행동 유도",
  },
};

export function ReferenceRoleImages({
  images,
  error,
  onAddFile,
  onRemoveImage,
}: {
  images: Partial<Record<ReferenceRole, ReferenceImageDraft>>;
  error: string;
  onAddFile: (role: ReferenceRole, files: FileList | null) => void;
  onRemoveImage: (role: ReferenceRole) => void;
}) {
  const inputs = useRef<Partial<Record<ReferenceRole, HTMLInputElement>>>({});
  const [draggingRole, setDraggingRole] = useState<ReferenceRole | null>(null);

  function dropImage(event: DragEvent<HTMLDivElement>, role: ReferenceRole) {
    event.preventDefault();
    setDraggingRole(null);
    onAddFile(role, event.dataTransfer.files);
  }

  return (
    <section
      aria-labelledby="repeating-reference-heading"
      className="grid gap-5 rounded-lg bg-surface-subtle p-6 max-md:p-4"
    >
      <div className="grid gap-2">
        <h2 id="repeating-reference-heading" className="font-semibold">
          반복형 레퍼런스
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          훅, 반복 본문, CTA의 대표 이미지를 한 장씩 추가하세요. 가운데 포맷은
          설정한 슬라이드 수에 맞춰 확장합니다.
        </p>
      </div>
      <div className="grid gap-3">
        {REFERENCE_ROLES.map((role) => {
          const image = images[role];
          const details = roleDetails[role];
          return (
            <div
              key={role}
              className={cn(
                "flex min-h-28 items-center gap-4 rounded-lg border border-dashed bg-background p-4 transition-colors max-md:flex-wrap",
                draggingRole === role && "border-foreground bg-muted",
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setDraggingRole(role);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setDraggingRole(null);
              }}
              onDrop={(event) => dropImage(event, role)}
            >
              {image ? (
                <Image
                  src={image.previewUrl}
                  alt={`${details.title} 레퍼런스`}
                  width={80}
                  height={80}
                  unoptimized
                  className="size-20 shrink-0 rounded-md border object-cover"
                />
              ) : (
                <span className="grid size-20 shrink-0 place-items-center rounded-md border bg-surface-subtle">
                  <Upload aria-hidden="true" className="size-5 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{details.title}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {image?.file.name ?? details.description}
                </p>
              </div>
              <input
                ref={(element) => { if (element) inputs.current[role] = element; }}
                id={`reference-${role}`}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label={`${details.title} 이미지`}
                aria-invalid={Boolean(error)}
                onChange={(event) => {
                  onAddFile(role, event.target.files);
                  event.target.value = "";
                }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => inputs.current[role]?.click()}
                >
                  {image ? "교체" : "파일 선택"}
                </Button>
                {image && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`${details.title} 이미지 삭제`}
                    onClick={() => onRemoveImage(role)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
