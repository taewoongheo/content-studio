"use client";

import { useState } from "react";
import { Check, ClipboardCopy, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProjectPromptCopyButton({ projectId, disabled, size = "default", onBeforeCopy }: {
  projectId: string;
  disabled?: boolean;
  size?: "default" | "sm";
  onBeforeCopy?: () => Promise<boolean>;
}) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");

  async function copy() {
    setStatus("copying");
    try {
      if (onBeforeCopy && !(await onBeforeCopy())) {
        setStatus("error");
        return;
      }
      await navigator.clipboard.writeText([
        "Content Studio MCP로 새 슬라이드 콘텐츠를 만들어줘.",
        `기준 프로젝트 ID: ${projectId}`,
        "list_template_guides의 재사용 가이드와 목록 메타데이터만으로 위 ID의 템플릿 등록을 확인해줘. 등록되어 있으면 clone_project의 templateProjectId로 복제해줘. 미등록이면 우회 생성하지 말고 대시보드에서 템플릿 등록이 필요하다고 알려줘.",
        "기준 프로젝트의 레이아웃, 요소 역할, 공유 스타일을 유지하면서 새 주제에 맞게 내용을 교체해줘.",
        "새 주제를 지정하지 않았다면 먼저 물어봐줘.",
      ].join("\n"));
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size={size} disabled={disabled || status === "copying"}
        title="이 프로젝트를 기준으로 새 콘텐츠를 만드는 Codex 요청문을 클립보드에 복사"
        onClick={() => void copy()}>
        {status === "copying" ? <LoaderCircle className="animate-spin" aria-hidden="true" />
          : status === "copied" ? <Check aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />}
        {status === "copied" ? "복사됨" : "제작 요청 복사"}
      </Button>
      <span role={status === "error" ? "alert" : "status"} className={status === "error" ? "text-xs text-destructive" : "sr-only"}>
        {status === "copied" ? "요청문을 복사했습니다. Codex에 붙여넣고 새 주제를 입력하세요."
          : status === "error" ? "복사하지 못했습니다. 변경 반영 상태와 클립보드 권한을 확인하고 다시 시도하세요." : ""}
      </span>
    </div>
  );
}
