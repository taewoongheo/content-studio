import { FormField } from "./form-field";
import { ReferenceImages } from "./reference-images";
import type { RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  templates,
  type ContentType,
  type Method,
  type Materials,
} from "./model";

const referenceDescriptions: Record<ContentType, string> = {
  slideshow:
    "링크 또는 이미지 중 하나 이상이 필요합니다. 커버와 본문 예시를 넣으면 시각적 구성을 참고할 수 있습니다.",
  video:
    "영상 링크 또는 대본·장면 설명 중 하나 이상이 필요합니다. 참고할 도입부와 장면 흐름을 알려주세요.",
  text: "글의 링크 또는 원문 중 하나 이상이 필요합니다. 문구를 그대로 복사하기보다 글의 구조와 표현을 참고합니다.",
};

export function MaterialsFields({
  type,
  method,
  value,
  onChange,
  error,
  fileError,
  referenceInput,
  onAddFiles,
  onRemoveFile,
}: {
  type: ContentType;
  method: Method;
  value: Materials;
  onChange: (patch: Partial<Materials>) => void;
  error: string;
  fileError: string;
  referenceInput: RefObject<HTMLInputElement | null>;
  onAddFiles: (list: FileList | null) => void;
  onRemoveFile: (index: number) => void;
}) {
  const { reference, referenceText, files, template, notes } = value;
  const imageReferences = type === "slideshow";
  const headings = {
    reference: "참고 자료",
    template: "구성 템플릿",
    scratch: "제작 방향",
  };
  const descriptions = {
    reference: referenceDescriptions[type],
    template:
      "콘텐츠의 전개 방식을 선택하세요. 시각 디자인이 아닌 내용 구성을 정하는 템플릿입니다.",
    scratch:
      "원하는 주제와 전달할 메시지를 알려주세요. 정해진 아이디어가 없어도 제품 정보를 바탕으로 준비할 수 있습니다.",
  };
  const heading = headings[method];
  const description = descriptions[method];
  return (
    <section
      className="grid gap-6 rounded-lg bg-surface-subtle p-6 max-md:p-4"
      aria-labelledby="materials-heading"
    >
      <div className="grid gap-2">
        <h2 id="materials-heading" className="text-base font-semibold">
          {heading}
        </h2>
        <p
          id="materials-hint"
          className="text-sm leading-6 text-muted-foreground"
        >
          {description}
        </p>
      </div>
      {method === "reference" && (
        <>
          <FormField>
            <Label htmlFor="reference-url">레퍼런스 링크</Label>
            <Input
              ref={referenceInput}
              id="reference-url"
              name="reference-url"
              type="url"
              autoComplete="url"
              spellCheck={false}
              value={reference}
              onChange={(event) => {
                onChange({ reference: event.target.value });
              }}
              placeholder="https://…"
              aria-invalid={Boolean(error)}
              aria-describedby={
                error ? "materials-hint reference-error" : "materials-hint"
              }
            />
            {error && (
              <p
                id="reference-error"
                role="alert"
                className={"my-2 text-sm leading-relaxed text-destructive"}
              >
                {error}
              </p>
            )}
          </FormField>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <span>또는</span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          {imageReferences ? (
            <ReferenceImages
              files={files}
              error={fileError}
              onAddFiles={onAddFiles}
              onRemoveFile={onRemoveFile}
            />
          ) : (
            <FormField>
              <Label htmlFor="reference-text">
                {type === "video" ? "참고할 대본·장면 설명" : "참고할 원문"}
              </Label>
              <Textarea
                id="reference-text"
                name="reference-text"
                aria-describedby="materials-hint"
                value={referenceText}
                onChange={(event) => {
                  onChange({ referenceText: event.target.value });
                }}
                maxLength={10000}
                placeholder={
                  type === "video"
                    ? "참고 영상의 대본이나 장면 흐름을 입력하세요."
                    : "구성과 표현을 참고할 글을 붙여넣으세요."
                }
              />
            </FormField>
          )}
        </>
      )}
      {method === "template" && (
        <RadioGroup
          name="template"
          aria-label="구성 템플릿"
          value={template}
          className={"grid gap-3"}
          onValueChange={(value) => onChange({ template: String(value) })}
        >
          {templates.map((item, index) => (
            <Label
              key={item}
              htmlFor={`template-${index}`}
              className={
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-background p-5 hover:bg-muted has-data-checked:border-foreground has-data-checked:inset-ring-1 has-data-checked:inset-ring-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-ring [&>[data-slot=radio-group-item]]:mt-0.5 [&>span]:min-w-0"
              }
            >
              <RadioGroupItem id={`template-${index}`} value={item} />
              <span>{item}</span>
            </Label>
          ))}
        </RadioGroup>
      )}
      <div className={method === "scratch" ? undefined : "border-t pt-6"}>
        <FormField>
          <Label htmlFor="notes">
            {method === "scratch" ? "아이디어와 제작 방향" : "추가 요청"}
            <span className="font-normal text-muted-foreground">선택</span>
          </Label>
          <Textarea
            id="notes"
            name="notes"
            aria-describedby="notes-hint"
            value={notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            maxLength={3000}
            placeholder="주제, 말투, 강조할 내용 등을 입력하세요."
          />
          <p
            id="notes-hint"
            className="text-sm leading-6 text-muted-foreground"
          >
            {method === "scratch"
              ? "선택 입력입니다. 비워두면 저장된 제품 설명과 대상 사용자를 기준으로 준비합니다."
              : "특히 참고할 부분, 원하는 말투, 포함하거나 제외할 내용을 적어주세요. 비워두어도 됩니다."}
          </p>
        </FormField>
      </div>
    </section>
  );
}
