import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { ProductContext } from "../../hooks/use-product-context";
import {
  contentTypes,
  creationMethods,
  getSettingsSummary,
  type ContentType,
  type Method,
  type Materials,
  type ContentSettings,
} from "./model";

export function ContentReviewDialog({
  open,
  onOpenChange,
  context,
  type,
  method,
  materials,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ProductContext;
  type: ContentType;
  method: Method;
  materials: Materials;
  settings: ContentSettings;
}) {
  const { reference, referenceText, files, template, notes } = materials;
  const imageReferences = type === "slideshow";
  const typeTitle = contentTypes.find((item) => item.id === type)!.title;
  const methodTitle = creationMethods.find((item) => item.id === method)!.title;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>입력 내용 확인</DialogTitle>
          <DialogDescription>
            선택한 제품 정보와 제작 조건을 확인하세요. AI 생성은 아직 연결되지
            않았습니다.
          </DialogDescription>
        </DialogHeader>
        <dl
          className={
            "grid gap-4 text-sm [&>div]:grid [&>div]:grid-cols-[7rem_minmax(0,1fr)] [&>div]:gap-4 [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:leading-relaxed [&_dd]:whitespace-pre-wrap [&_dd]:wrap-anywhere"
          }
        >
          <div>
            <dt>제품</dt>
            <dd>{context.name}</dd>
          </div>
          <div>
            <dt>제품 설명</dt>
            <dd>{context.description}</dd>
          </div>
          {context.audience && (
            <div>
              <dt>대상 사용자</dt>
              <dd>{context.audience}</dd>
            </div>
          )}
          {context.constraints && (
            <div>
              <dt>표현·제약</dt>
              <dd>{context.constraints}</dd>
            </div>
          )}
          <div>
            <dt>콘텐츠 유형</dt>
            <dd>{typeTitle}</dd>
          </div>
          <div>
            <dt>제작 방식</dt>
            <dd>{methodTitle}</dd>
          </div>
          {method === "reference" && (
            <div>
              <dt>참고 자료</dt>
              <dd>
                {reference && <p>{reference}</p>}
                {imageReferences
                  ? files.map((file, index) => <p key={index}>{file.name}</p>)
                  : referenceText && <p>{referenceText}</p>}
              </dd>
            </div>
          )}
          {method === "template" && (
            <div>
              <dt>구성 템플릿</dt>
              <dd>{template}</dd>
            </div>
          )}
          {notes && (
            <div>
              <dt>추가 요청</dt>
              <dd>{notes}</dd>
            </div>
          )}
          <div>
            <dt>기본 설정</dt>
            <dd>{getSettingsSummary(type, settings)}</dd>
          </div>
        </dl>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => onOpenChange(false)}
        >
          입력 수정
        </Button>
      </DialogContent>
    </Dialog>
  );
}
