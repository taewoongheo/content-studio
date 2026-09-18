"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, FileImage, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { ProductContext } from "./use-product-context";

const types = [
  {
    id: "slideshow",
    title: "슬라이드쇼",
    description:
      "여러 장의 이미지로 이야기를 전달합니다. 참고 이미지, 슬라이드 수와 비율을 설정할 수 있습니다.",
  },
  {
    id: "video",
    title: "영상",
    description:
      "장면과 흐름이 있는 콘텐츠를 준비합니다. 참고 영상이나 대본, 목표 길이와 비율을 설정할 수 있습니다.",
  },
  {
    id: "text",
    title: "텍스트",
    description:
      "SNS 게시글이나 소개 글을 준비합니다. 참고할 원문, 글 유형과 목표 분량을 설정할 수 있습니다.",
  },
] as const;
type ContentType = (typeof types)[number]["id"];
const methods = [
  {
    id: "reference",
    title: "레퍼런스 기반",
    description: "참고 자료의 구성과 표현 방식을 활용합니다.",
  },
  {
    id: "template",
    title: "템플릿 기반",
    description: "준비된 글의 구성에 제품 정보를 담습니다.",
  },
  {
    id: "scratch",
    title: "처음부터 만들기",
    description: "참고 자료 없이 제품 정보와 아이디어로 시작합니다.",
  },
] as const;
type Method = (typeof methods)[number]["id"];
const templates = ["문제 → 해결", "핵심 팁 리스트", "단계별 가이드"];

function Setting({
  id,
  label,
  value,
  options,
  onChange,
  description,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  description?: string;
}) {
  return (
    <div
      className={
        "flex min-w-0 flex-col gap-2.5 [&_label]:text-sm [&_label]:leading-normal [&_input]:min-h-11 [&_select]:min-h-11 [&_textarea]:min-h-28 [&_textarea]:resize-y [&_textarea]:p-3 [&_textarea]:leading-relaxed [&_input]:bg-background [&_textarea]:bg-background [&_select]:bg-background [&_[data-slot=native-select-wrapper]]:w-full max-md:[&_input]:text-base max-md:[&_textarea]:text-base max-md:[&_select]:text-base"
      }
    >
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        name={id}
        value={value}
        aria-describedby={description ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {description && (
        <p
          id={`${id}-hint`}
          className="text-sm leading-6 text-muted-foreground"
        >
          {description}
        </p>
      )}
    </div>
  );
}

export function ContentWizard({
  context,
  onRegisterContext,
}: {
  context: ProductContext | null;
  onRegisterContext: () => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [type, setType] = useState<ContentType>("slideshow");
  const [method, setMethod] = useState<Method>("reference");
  const [reference, setReference] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [template, setTemplate] = useState(templates[0]);
  const [notes, setNotes] = useState("");
  const [ratio, setRatio] = useState("4:5");
  const [count, setCount] = useState("6장");
  const [videoRatio, setVideoRatio] = useState("9:16");
  const [duration, setDuration] = useState("30초");
  const [channel, setChannel] = useState("SNS 게시글");
  const [length, setLength] = useState("보통 · 약 500자");
  const [language, setLanguage] = useState("한국어");
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const referenceInput = useRef<HTMLInputElement>(null);
  const typeTitle = types.find((item) => item.id === type)!.title;
  const methodTitle = methods.find((item) => item.id === method)!.title;
  const imageReferences = type === "slideshow";
  const hasMaterial = Boolean(
    reference.trim() || (imageReferences ? files.length : referenceText.trim()),
  );

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    if (
      files.length + incoming.length > 5 ||
      incoming.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 10 * 1024 * 1024,
      )
    ) {
      setFileError(
        "PNG, JPG, WebP 이미지를 장당 10MB 이하로, 최대 5장 선택해 주세요.",
      );
      return;
    }
    setFiles((previous) => [...previous, ...incoming]);
    setFileError("");
    setError("");
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) return;
    if (method === "reference") {
      if (!hasMaterial) {
        setError(
          imageReferences
            ? "레퍼런스 링크 또는 이미지를 추가해 주세요."
            : "레퍼런스 링크 또는 참고할 내용을 입력해 주세요.",
        );
        referenceInput.current?.focus();
        return;
      }
      if (reference.trim()) {
        try {
          const url = new URL(reference);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch {
          setError("http:// 또는 https://로 시작하는 링크를 입력해 주세요.");
          referenceInput.current?.focus();
          return;
        }
      }
    }
    setError("");
    setReviewOpen(true);
  }

  if (!context)
    return (
      <section
        className={
          "flex max-w-[640px] flex-col items-start gap-4 rounded-lg border p-8 max-md:p-6"
        }
        aria-labelledby="context-required"
      >
        <h2
          id="context-required"
          className="text-xl font-semibold tracking-tight"
        >
          제품 컨텍스트를 먼저 등록하세요
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          제품 이름과 설명을 저장하면 콘텐츠를 만들 수 있습니다.
        </p>
        <Button className="h-11 px-5" onClick={onRegisterContext}>
          제품 컨텍스트 등록
          <ArrowRight aria-hidden="true" />
        </Button>
      </section>
    );

  return (
    <div className={"max-w-[850px]"}>
      <form onSubmit={review} className="grid gap-8">
        <section aria-labelledby="content-type-heading" className="grid gap-3">
          <h2 id="content-type-heading" className="text-base font-semibold">
            콘텐츠 유형
          </h2>
          <RadioGroup
            name="content-type"
            aria-labelledby="content-type-heading"
            value={type}
            className="grid grid-cols-3 gap-3 max-lg:grid-cols-1"
            onValueChange={(value) => {
              setType(value as ContentType);
              setError("");
              setFileError("");
            }}
          >
            {types.map(({ id, title, description }) => (
              <Label
                key={id}
                htmlFor={`type-${id}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted has-data-checked:border-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
              >
                <RadioGroupItem
                  id={`type-${id}`}
                  value={id}
                  className="mt-0.5"
                  aria-describedby={`type-${id}-hint`}
                />
                <span>
                  <span className="text-sm font-medium leading-5">{title}</span>
                  <span
                    id={`type-${id}-hint`}
                    className="mt-2 block text-sm font-normal leading-6 text-muted-foreground"
                  >
                    {description}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </section>
        <section aria-labelledby="method-heading" className="grid gap-3">
          <h2 id="method-heading" className="text-base font-semibold">
            제작 방식
          </h2>
          <RadioGroup
            name="method"
            aria-labelledby="method-heading"
            value={method}
            className="grid grid-cols-3 gap-3 max-lg:grid-cols-1"
            onValueChange={(value) => {
              setMethod(value as Method);
              setError("");
            }}
          >
            {methods.map(({ id, title, description }) => (
              <Label
                key={id}
                htmlFor={`method-${id}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted has-data-checked:border-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
              >
                <RadioGroupItem
                  id={`method-${id}`}
                  value={id}
                  className="mt-0.5"
                  aria-describedby={`method-${id}-hint`}
                />
                <span>
                  <span className="text-sm font-medium leading-5">{title}</span>
                  <span
                    id={`method-${id}-hint`}
                    className="mt-2 block text-sm font-normal leading-6 text-muted-foreground"
                  >
                    {description}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </section>
        <section
          className="grid gap-6 border-t pt-6"
          aria-labelledby="materials-heading"
        >
          <div className="grid gap-2">
            <h2 id="materials-heading" className="text-base font-semibold">
              {method === "reference"
                ? "참고 자료"
                : method === "template"
                  ? "구성 템플릿"
                  : "제작 방향"}
            </h2>
            <p
              id="materials-hint"
              className="text-sm leading-6 text-muted-foreground"
            >
              {method === "reference"
                ? imageReferences
                  ? "링크 또는 이미지 중 하나 이상이 필요합니다. 커버와 본문 예시를 넣으면 시각적 구성을 참고할 수 있습니다."
                  : type === "video"
                    ? "영상 링크 또는 대본·장면 설명 중 하나 이상이 필요합니다. 참고할 도입부와 장면 흐름을 알려주세요."
                    : "글의 링크 또는 원문 중 하나 이상이 필요합니다. 문구를 그대로 복사하기보다 글의 구조와 표현을 참고합니다."
                : method === "template"
                  ? "콘텐츠의 전개 방식을 선택하세요. 시각 디자인이 아닌 내용 구성을 정하는 템플릿입니다."
                  : "원하는 주제와 전달할 메시지를 알려주세요. 정해진 아이디어가 없어도 제품 정보를 바탕으로 준비할 수 있습니다."}
            </p>
          </div>
          {method === "reference" && (
            <>
              <div
                className={
                  "flex min-w-0 flex-col gap-2.5 [&_label]:text-sm [&_label]:leading-normal [&_input]:min-h-11 [&_select]:min-h-11 [&_textarea]:min-h-28 [&_textarea]:resize-y [&_textarea]:p-3 [&_textarea]:leading-relaxed [&_input]:bg-background [&_textarea]:bg-background [&_select]:bg-background [&_[data-slot=native-select-wrapper]]:w-full max-md:[&_input]:text-base max-md:[&_textarea]:text-base max-md:[&_select]:text-base"
                }
              >
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
                    setReference(event.target.value);
                    setError("");
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
              </div>
              {imageReferences ? (
                <>
                  <div
                    className={
                      "flex min-w-0 flex-col gap-2.5 [&_label]:text-sm [&_label]:leading-normal [&_input]:min-h-11 [&_select]:min-h-11 [&_textarea]:min-h-28 [&_textarea]:resize-y [&_textarea]:p-3 [&_textarea]:leading-relaxed [&_input]:bg-background [&_textarea]:bg-background [&_select]:bg-background [&_[data-slot=native-select-wrapper]]:w-full max-md:[&_input]:text-base max-md:[&_textarea]:text-base max-md:[&_select]:text-base"
                    }
                  >
                    <Label htmlFor="reference-images">
                      또는 레퍼런스 이미지
                    </Label>
                    <div
                      className={
                        "grid gap-4 rounded-lg border border-dashed p-4 [&_input]:h-auto [&_input]:p-2"
                      }
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        addFiles(event.dataTransfer.files);
                      }}
                    >
                      <Input
                        id="reference-images"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        onChange={(event) => {
                          addFiles(event.target.files);
                          event.target.value = "";
                        }}
                      />
                      <p className="text-sm text-muted-foreground">
                        파일을 선택하거나 여기에 끌어놓으세요. PNG, JPG, WebP ·
                        최대 5장 · 장당 10MB
                      </p>
                    </div>
                  </div>
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
                            onClick={() =>
                              setFiles((previous) =>
                                previous.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <X aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {fileError && (
                    <p
                      role="alert"
                      className={
                        "my-2 text-sm leading-relaxed text-destructive"
                      }
                    >
                      {fileError}
                    </p>
                  )}
                </>
              ) : (
                <div
                  className={
                    "flex min-w-0 flex-col gap-2.5 [&_label]:text-sm [&_label]:leading-normal [&_input]:min-h-11 [&_select]:min-h-11 [&_textarea]:min-h-28 [&_textarea]:resize-y [&_textarea]:p-3 [&_textarea]:leading-relaxed [&_input]:bg-background [&_textarea]:bg-background [&_select]:bg-background [&_[data-slot=native-select-wrapper]]:w-full max-md:[&_input]:text-base max-md:[&_textarea]:text-base max-md:[&_select]:text-base"
                  }
                >
                  <Label htmlFor="reference-text">
                    {type === "video"
                      ? "또는 참고할 대본·장면 설명"
                      : "또는 참고할 원문"}
                  </Label>
                  <Textarea
                    id="reference-text"
                    name="reference-text"
                    aria-describedby="materials-hint"
                    value={referenceText}
                    onChange={(event) => {
                      setReferenceText(event.target.value);
                      setError("");
                    }}
                    maxLength={10000}
                    placeholder={
                      type === "video"
                        ? "참고 영상의 대본이나 장면 흐름을 입력하세요."
                        : "구성과 표현을 참고할 글을 붙여넣으세요."
                    }
                  />
                </div>
              )}
            </>
          )}
          {method === "template" && (
            <RadioGroup
              name="template"
              aria-label="구성 템플릿"
              value={template}
              className={"grid gap-3"}
              onValueChange={(value) => setTemplate(String(value))}
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
          <div
            className={
              "flex min-w-0 flex-col gap-2.5 [&_label]:text-sm [&_label]:leading-normal [&_input]:min-h-11 [&_select]:min-h-11 [&_textarea]:min-h-28 [&_textarea]:resize-y [&_textarea]:p-3 [&_textarea]:leading-relaxed [&_input]:bg-background [&_textarea]:bg-background [&_select]:bg-background [&_[data-slot=native-select-wrapper]]:w-full max-md:[&_input]:text-base max-md:[&_textarea]:text-base max-md:[&_select]:text-base"
            }
          >
            <Label htmlFor="notes">
              {method === "scratch" ? "아이디어와 제작 방향" : "추가 요청"}
              <span className="font-normal text-muted-foreground">선택</span>
            </Label>
            <Textarea
              id="notes"
              name="notes"
              aria-describedby="notes-hint"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
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
          </div>
        </section>
        <section
          className="grid gap-4 border-t pt-6"
          aria-labelledby="settings-heading"
        >
          <div className="grid gap-2">
            <h2 id="settings-heading" className="text-base font-semibold">
              {typeTitle} 설정
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {type === "text"
                ? "게시할 곳과 원하는 글의 분량에 맞춰 설정하세요."
                : "게시할 화면과 원하는 콘텐츠 길이에 맞춰 설정하세요."}{" "}
              기본값을 그대로 사용해도 됩니다.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            {type === "slideshow" && (
              <>
                <Setting
                  id="ratio"
                  description="4:5는 세로 피드, 1:1은 정사각형, 9:16은 전체 화면입니다."
                  label="화면 비율"
                  value={ratio}
                  onChange={setRatio}
                  options={["4:5", "1:1", "9:16"]}
                />
                <Setting
                  id="count"
                  description="커버와 마지막 장을 포함한 전체 장수입니다."
                  label="슬라이드 수"
                  value={count}
                  onChange={setCount}
                  options={["4장", "5장", "6장", "7장", "8장", "9장", "10장"]}
                />
              </>
            )}
            {type === "video" && (
              <>
                <Setting
                  id="video-ratio"
                  description="9:16은 세로 영상, 16:9는 가로 영상입니다."
                  label="화면 비율"
                  value={videoRatio}
                  onChange={setVideoRatio}
                  options={["9:16", "16:9", "1:1"]}
                />
                <Setting
                  id="duration"
                  description="영상 구성과 대본을 맞출 목표 길이입니다."
                  label="목표 영상 길이"
                  value={duration}
                  onChange={setDuration}
                  options={["15초", "30초", "60초"]}
                />
              </>
            )}
            {type === "text" && (
              <>
                <Setting
                  id="channel"
                  description="게시할 곳에 맞는 글의 구조를 정합니다."
                  label="글 유형"
                  value={channel}
                  onChange={setChannel}
                  options={["SNS 게시글", "블로그 글", "제품 소개 글"]}
                />
                <Setting
                  id="length"
                  description="생성 시 참고할 대략적인 분량입니다."
                  label="목표 분량"
                  value={length}
                  onChange={setLength}
                  options={[
                    "짧게 · 약 200자",
                    "보통 · 약 500자",
                    "길게 · 약 1,500자",
                  ]}
                />
              </>
            )}
            <Setting
              id="language"
              description="결과물에 사용할 언어입니다."
              label="콘텐츠 언어"
              value={language}
              onChange={setLanguage}
              options={["한국어", "English"]}
            />
          </div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            현재는 입력 확인까지 지원합니다. AI 생성은 준비 중이며, 제작 입력은
            새로고침하면 초기화됩니다.
          </p>
          <Button type="submit" className="h-11 px-5">
            입력 내용 확인
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </form>
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>입력 내용 확인</DialogTitle>
            <DialogDescription>
              선택한 제품 정보와 제작 조건을 확인하세요. AI 생성은 아직 연결되지
              않았습니다.
            </DialogDescription>
          </DialogHeader>
          <>
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
                      ? files.map((file, index) => (
                          <p key={index}>{file.name}</p>
                        ))
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
                <dd>
                  {type === "slideshow"
                    ? `${ratio} · ${count}`
                    : type === "video"
                      ? `${videoRatio} · ${duration}`
                      : `${channel} · ${length}`}{" "}
                  · {language}
                </dd>
              </div>
            </dl>
          </>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => setReviewOpen(false)}
          >
            입력 수정
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
