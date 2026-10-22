import { CheckCircle2, CircleDashed, LoaderCircle, PauseCircle, TriangleAlert } from "lucide-react";
export function StatusIcon({ state, size = 20 }: { state: string; size?: number }) {
  const complete = state === "completed" || state === "finished";
  const Icon = complete ? CheckCircle2 : state === "running" ? LoaderCircle : state === "failed" ? TriangleAlert : state === "stopped" ? PauseCircle : CircleDashed;
  const label = complete ? "완료" : state === "running" ? "실행 중" : state === "failed" ? "실패" : state === "stopped" ? "중단" : "대기";
  return <span className={`production-status ${complete ? "is-complete" : ""} ${state === "failed" ? "is-failed" : ""}`} role="img" aria-label={label} title={label}>
    <Icon size={size} className={state === "running" ? "animate-spin" : ""} />
  </span>;
}
