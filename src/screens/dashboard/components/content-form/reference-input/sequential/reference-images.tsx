import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Upload, X } from "lucide-react";
import Image from "next/image";
import {
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FormField } from "../../form-field";
import type { ReferenceImageDraft } from "../reference-images-model";

function ReferenceThumbnail({ image }: { image: ReferenceImageDraft }) {
  return (
    <Image
      src={image.previewUrl}
      alt=""
      width={64}
      height={64}
      unoptimized
      className="size-16 shrink-0 rounded-md border object-cover"
    />
  );
}

function SortableReferenceImage({
  image,
  index,
  onRemove,
}: {
  image: ReferenceImageDraft;
  index: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex min-h-20 items-center gap-3 rounded-lg border bg-background p-2 transition-shadow motion-reduce:transition-none",
        isDragging && "relative z-10 shadow-md",
      )}
    >
      <span className="w-6 text-center text-sm tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <ReferenceThumbnail image={image} />
      <span className="min-w-0 flex-1 truncate text-sm">
        {image.file.name}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={`${image.file.name} 순서 변경`}
      >
        <GripVertical aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`${image.file.name} 삭제`}
        onClick={() => onRemove(image.id)}
      >
        <X aria-hidden="true" />
      </Button>
    </li>
  );
}

export function ReferenceImages({
  images,
  error,
  inputRef,
  onAddFiles,
  onRemoveImage,
  onReorderImages,
}: {
  images: ReferenceImageDraft[];
  error: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onAddFiles: (list: FileList | null) => void;
  onRemoveImage: (id: string) => void;
  onReorderImages: (activeId: string, overId: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  function finishReordering(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    onReorderImages(String(event.active.id), String(event.over.id));
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
      {images.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={finishReordering}
        >
          <SortableContext
            items={images.map((image) => image.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="grid gap-2">
              {images.map((image, index) => (
                <SortableReferenceImage
                  key={image.id}
                  image={image}
                  index={index}
                  onRemove={onRemoveImage}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
