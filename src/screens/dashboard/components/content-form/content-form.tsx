"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import { createContentJob } from "@/screens/content-job/api";
import type { ProductContext } from "../../hooks/use-product-context";
import { ContentReviewDialog } from "./content-review-dialog";
import { ReferenceImages } from "./reference-input/reference-images";
import { ChoiceSection } from "./selection/choice-section";
import { contentTypes, creationMethods } from "./selection/model";
import { ContentSettings } from "./settings/content-settings";
import { slideCount } from "./settings/model";
import { useContentForm } from "./use-content-form";
import { WorkflowPlaceholder } from "./workflow-placeholder";

export function ContentForm({
  context,
  onRegisterContext,
  onJobStarted,
}: {
  context: ProductContext | null;
  onRegisterContext: () => void;
  onJobStarted: (job: ContentJobSnapshot) => void;
}) {
  const form = useContentForm(context);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  if (!context)
    return (
      <section className="flex max-w-[640px] flex-col items-start gap-4 rounded-lg border p-8 max-md:p-6" aria-labelledby="context-required">
        <h2 id="context-required" className="text-xl font-semibold tracking-tight">
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
  const productContext = context;

  async function start() {
    if (!form.canCreate) return;
    setStarting(true);
    setStartError("");
    try {
      const job = await createContentJob({
        context: productContext,
        files: form.files,
        aspectRatio: form.settings.ratio,
        slideCount: slideCount(form.settings),
        outputLanguage: form.settings.language,
      });
      form.setReviewOpen(false);
      onJobStarted(job);
    } catch (error) {
      setStartError(
        error instanceof Error ? error.message : "분석을 시작하지 못했습니다.",
      );
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="max-w-[850px]">
      <form onSubmit={form.review} className="grid gap-8">
        <ChoiceSection
          name="content-type"
          title="콘텐츠 유형"
          value={form.type}
          columns={2}
          options={contentTypes}
          onChange={form.changeType}
        />
        <ChoiceSection
          name="creation-method"
          title="제작 방식"
          value={form.method}
          columns={3}
          options={creationMethods}
          onChange={form.changeMethod}
        />
        {form.canCreate ? (
          <>
            <ReferenceImages
              images={form.referenceImages}
              error={form.error || form.fileError}
              inputRef={form.referenceInput}
              onAddFiles={form.addFiles}
              onRemoveImage={form.removeImage}
              onReorderImages={form.reorderImages}
            />
            <ContentSettings
              value={form.settings}
              onChange={form.changeSettings}
            />
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                이미지가 분석된 뒤 전략, 본문, 훅을 순서대로 검토합니다.
              </p>
              <Button type="submit" className="h-11 px-5">
                입력 내용 확인
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </>
        ) : (
          <WorkflowPlaceholder type={form.type} method={form.method} />
        )}
      </form>
      <ContentReviewDialog
        open={form.reviewOpen}
        onOpenChange={form.setReviewOpen}
        context={context}
        files={form.files}
        settings={form.settings}
        starting={starting}
        error={startError}
        onStart={() => void start()}
      />
    </div>
  );
}
