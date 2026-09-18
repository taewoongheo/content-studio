"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProductContext } from "../../hooks/use-product-context";
import { contentTypes, creationMethods } from "./model";
import { ChoiceSection } from "./choice-section";
import { MaterialsFields } from "./materials-fields";
import { ContentSettings } from "./content-settings";
import { ContentReviewDialog } from "./content-review-dialog";
import { useContentForm } from "./use-content-form";

export function ContentForm({
  context,
  onRegisterContext,
}: {
  context: ProductContext | null;
  onRegisterContext: () => void;
}) {
  const form = useContentForm(context);

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
    <div className="max-w-[850px]">
      <form onSubmit={form.review} className="grid gap-8">
        <ChoiceSection
          name="content-type"
          idPrefix="type"
          title="콘텐츠 유형"
          options={contentTypes}
          value={form.type}
          onChange={form.changeType}
        />
        <ChoiceSection
          name="method"
          idPrefix="method"
          title="제작 방식"
          options={creationMethods}
          value={form.method}
          onChange={form.changeMethod}
        />
        <MaterialsFields
          type={form.type}
          method={form.method}
          value={form.materials}
          onChange={form.changeMaterials}
          error={form.error}
          fileError={form.fileError}
          referenceInput={form.referenceInput}
          onAddFiles={form.addFiles}
          onRemoveFile={form.removeFile}
        />
        <ContentSettings
          type={form.type}
          value={form.settings}
          onChange={form.changeSettings}
        />
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
      <ContentReviewDialog
        open={form.reviewOpen}
        onOpenChange={form.setReviewOpen}
        context={context}
        type={form.type}
        method={form.method}
        materials={form.materials}
        settings={form.settings}
      />
    </div>
  );
}
