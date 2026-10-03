import { getWorkflowLabel } from "./selection/model";
import type {
  ContentType,
  CreationMethod,
  SlideshowStructure,
} from "./selection/model";

export function WorkflowPlaceholder({
  type,
  method,
  structure,
}: {
  type: ContentType;
  method: CreationMethod;
  structure: SlideshowStructure;
}) {
  return (
    <section className="grid min-h-44 place-items-center rounded-lg border border-dashed p-8 text-center">
      <div className="grid max-w-md gap-2">
        <h2 className="font-semibold">
          {getWorkflowLabel(type, method)}
          {type === "slideshow" && ` · ${structure === "repeating" ? "반복형" : "장면별 구성"}`}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          이 조합의 입력 화면은 다음 단계에서 구현합니다. 현재는 슬라이드의
          레퍼런스 기반 제작만 사용할 수 있습니다.
        </p>
      </div>
    </section>
  );
}
