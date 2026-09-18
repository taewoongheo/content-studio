"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ProductContext } from "./use-product-context";

export function ProductContextForm({
  context,
  onSave,
  onCreate,
}: {
  context: ProductContext | null;
  onSave: (value: ProductContext) => void;
  onCreate: () => void;
}) {
  const [draft, setDraft] = useState<ProductContext>(
    context ?? { name: "", description: "", audience: "", constraints: "" },
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(context);

  function update(field: keyof ProductContext, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setMessage("");
    setError("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = !draft.name.trim()
      ? "name"
      : !draft.description.trim()
        ? "description"
        : null;
    if (field) {
      setErrorField(field);
      setError("공백이 아닌 내용을 입력해 주세요.");
      const input = event.currentTarget.elements.namedItem(field);
      if (input instanceof HTMLElement) input.focus();
      return;
    }
    try {
      const value = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        audience: draft.audience.trim(),
        constraints: draft.constraints.trim(),
      };
      onSave(value);
      setDraft(value);
      setError("");
      setMessage("제품 컨텍스트를 저장했습니다.");
    } catch {
      setErrorField("");
      setError(
        "저장하지 못했습니다. 브라우저 저장소 설정을 확인한 뒤 다시 시도해 주세요.",
      );
    }
  }

  return (
    <form onSubmit={submit} className={"grid max-w-[640px] gap-6"}>
      <p className="text-sm text-muted-foreground">* 필수 입력</p>
      {(
        [
          {
            key: "name",
            label: "제품 이름",
            placeholder: "예: LiftCode",
            max: 80,
            multiline: false,
            required: true,
          },
          {
            key: "description",
            label: "제품 설명과 핵심 가치",
            placeholder: "제품이 해결하는 문제와 주요 특징을 입력하세요.",
            max: 2000,
            multiline: true,
            required: true,
          },
          {
            key: "audience",
            label: "대상 사용자",
            placeholder: "예: 꾸준히 운동하고 싶은 사람",
            max: 200,
            multiline: false,
            required: false,
          },
          {
            key: "constraints",
            label: "표현과 제약 사항",
            placeholder:
              "예: 친근한 말투, 과장된 효과나 검증되지 않은 주장 제외",
            max: 2000,
            multiline: true,
            required: false,
          },
        ] as const
      ).map(({ key, label, placeholder, max, multiline, required }) => {
        const Control = multiline ? Textarea : Input;
        return (
          <div
            key={key}
            className={
              "flex min-w-0 flex-col gap-2.5 [&_label]:text-sm [&_label]:leading-normal [&_input]:min-h-11 [&_select]:min-h-11 [&_textarea]:min-h-28 [&_textarea]:resize-y [&_textarea]:p-3 [&_textarea]:leading-relaxed [&_input]:bg-background [&_textarea]:bg-background [&_select]:bg-background [&_[data-slot=native-select-wrapper]]:w-full max-md:[&_input]:text-base max-md:[&_textarea]:text-base max-md:[&_select]:text-base"
            }
          >
            <Label htmlFor={`product-${key}`}>
              {label}
              {required ? (
                " *"
              ) : (
                <span className="font-normal text-muted-foreground">선택</span>
              )}
            </Label>
            <Control
              id={`product-${key}`}
              name={key}
              autoComplete="off"
              value={draft[key]}
              onChange={(event) => update(key, event.target.value)}
              placeholder={placeholder}
              maxLength={max}
              required={required}
              aria-invalid={Boolean(error && errorField === key)}
              aria-describedby={
                error && errorField === key ? "product-error" : undefined
              }
            />
            {error && errorField === key && (
              <p
                id="product-error"
                role="alert"
                className={"my-2 text-sm leading-relaxed text-destructive"}
              >
                {error}
              </p>
            )}
          </div>
        );
      })}
      {error && !errorField && (
        <p
          role="alert"
          className={"my-2 text-sm leading-relaxed text-destructive"}
        >
          {error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        이 브라우저에 저장하며, 이후 콘텐츠 제작에 재사용합니다.
      </p>
      <div className={"flex flex-wrap gap-3"}>
        <Button type="submit" className="h-11 px-5">
          제품 컨텍스트 저장
        </Button>
        {context && (
          <Button
            type="button"
            variant="outline"
            className="h-11 px-5"
            disabled={dirty}
            onClick={onCreate}
          >
            새 콘텐츠 만들기
          </Button>
        )}
      </div>
      <p role="status" className="text-sm">
        {message ||
          (dirty && context ? "변경 내용을 저장한 뒤 제작을 시작하세요." : "")}
      </p>
    </form>
  );
}
