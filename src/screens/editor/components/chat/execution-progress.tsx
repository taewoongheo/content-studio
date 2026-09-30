import { Check, Circle, LoaderCircle, X } from "lucide-react";
import type { EditorMessage } from "@/lib/content-jobs/editor/types";

export function ExecutionProgress({ execution }: { execution: NonNullable<EditorMessage["execution"]> }) {
  return <div className="grid gap-2 border-l-2 border-muted pl-3 py-1 text-xs" aria-label="AI 작업 진행">
    <ol className="grid gap-2">
      {execution.steps.map((step) => {
        const Icon = step.status === "completed" ? Check : step.status === "running" ? LoaderCircle
          : step.status === "failed" ? X : Circle;
        return <li key={step.id} className={`flex items-center gap-2 ${step.status === "running" ? "text-foreground" :
          step.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
          <Icon aria-hidden="true" className={`size-3.5 shrink-0 ${step.status === "running" ? "motion-safe:animate-spin" : ""}`} />
          <span>{step.label}</span>
          <span className="sr-only">{({ pending: "대기", running: "진행 중", completed: "완료", failed: "실패", skipped: "실행 안 함" })[step.status]}</span>
        </li>;
      })}
    </ol>
    {execution.error && <p role="alert" className="text-destructive">{execution.error}</p>}
  </div>;
}
