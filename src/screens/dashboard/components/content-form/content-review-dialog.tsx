import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProductContext } from "../../hooks/use-product-context";
import type { SlideshowStructure } from "@/lib/content-jobs/domain/types";
import {
  getSettingsSummary,
  type ContentSettings,
} from "./settings/model";

export function ContentReviewDialog({
  open,
  onOpenChange,
  context,
  model,
  structure,
  files,
  settings,
  starting,
  error,
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ProductContext;
  model: string;
  structure: SlideshowStructure;
  files: File[];
  settings: ContentSettings;
  starting: boolean;
  error: string;
  onStart: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={starting ? undefined : onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>분석 전 확인</DialogTitle>
          <DialogDescription>
            이 입력으로 작업 thread를 만들고 레퍼런스 분석을 시작합니다.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-4 text-sm [&>div]:grid [&>div]:grid-cols-[7rem_minmax(0,1fr)] [&>div]:gap-4 [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:leading-relaxed">
          <div>
            <dt>제품</dt>
            <dd>{context.name}</dd>
          </div>
          <div>
            <dt>Codex 모델</dt>
            <dd>{model || "선택 필요"}</dd>
          </div>
          <div>
            <dt>게시 대상</dt>
            <dd>TikTok 슬라이드쇼</dd>
          </div>
          <div>
            <dt>슬라이드 구성</dt>
            <dd>{structure === "repeating" ? "반복형" : "장면별 구성"}</dd>
          </div>
          <div>
            <dt>레퍼런스</dt>
            <dd>{structure === "repeating" ? "훅 · 반복 본문 · CTA 대표 이미지" : `${files.length}장`}</dd>
          </div>
          <div>
            <dt>설정</dt>
            <dd>{getSettingsSummary(settings)}</dd>
          </div>
        </dl>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={starting}
            onClick={() => onOpenChange(false)}
          >
            입력 수정
          </Button>
          <Button
            type="button"
            className="h-11 px-5"
            disabled={starting || !model}
            onClick={onStart}
          >
            {starting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            분석 시작
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
