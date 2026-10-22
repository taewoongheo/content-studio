import type { ProductionSnapshot } from "@/domains/content-production/client";
import type { WorkDetail, Row } from "@/domains/content-production/domain/contracts";

const examples = [
  { topic: "주 3일 전신 루틴", answer: "주 3일, 기본 동작 5개로 시작하는 루틴", hook: "YOUR FIRST 3-DAY GYM PLAN", type: "루틴" },
  { topic: "덤벨만 있는 홈트", answer: "덤벨 한 쌍으로 전신을 운동하는 구성", hook: "ONLY DUMBBELLS? START HERE", type: "장비별 루틴" },
  { topic: "등 운동 대안", answer: "허리에 부담을 느낄 때 선택할 등 운동 대안", hook: "BUILD YOUR BACK WITH SUPPORT", type: "대안 비교" },
  { topic: "처음 운동 무게 고르기", answer: "첫 세트 반응을 보고 시작 무게를 정하는 방법", hook: "PICK YOUR FIRST WORKING WEIGHT", type: "실행 가이드" },
];
export interface Simulation {
  data: ProductionSnapshot;
  details: Record<string, WorkDetail>;
  progress: Record<string, number>;
  writes: Record<string, number>;
  activity: Record<string, string>;
  failedOnce: string[];
  tick: number;
  withFailure: boolean;
}
const time = (tick: number) => new Date(Date.UTC(2026, 9, 23, 3, 0, tick)).toISOString();
export function emptySimulation(): Simulation {
  return {
    data: { tasks: [], logs: [{ id: "mock-history", name: "처음 헬스장에 가는 날", topic: "첫 운동", content_type: "체크리스트", message: "처음 방문했을 때 바로 따라 할 준비 순서", project_id: "mock-history-post", completed_at: time(0), observed_at: time(0), view_count: 18400, like_count: 760, save_count: 290, comment_count: 12, share_count: 55 }], references: [{ id: "mock-reference", title: "짧은 훅과 한 장 루틴", topic: "루틴", content_type: "한 장 요약", project_id: "mock-reference-post", parts: [{ aspect: "visual", location: "본문", reason: "운동·세트·횟수를 같은 줄에서 읽을 수 있다.", usage_context: "즉시 실행할 루틴 안내" }] }], visuals: [], sync: { running: false }, settings: { model: "gpt-5.6-sol" }, configured: { apify: true } },
    details: {}, progress: {}, writes: {}, activity: {}, failedOnce: [], tick: 0, withFailure: false,
  };
}
export function startSimulation(count: number, withFailure: boolean, firstIndex = 1): Simulation {
  const model = emptySimulation();
  model.withFailure = withFailure;
  model.data.sync.running = true;
  for (let index = 0; index < count; index++) {
    const id = `mock-task-${index + firstIndex}`, example = examples[index % examples.length];
    const task = { id, log_id: `mock-log-${index + firstIndex}`, current_step: "analysis" as const, state: "pending", created_at: time(0), updated_at: time(0), project_id: null, topic: example.topic, content_type: example.type };
    model.data.tasks.push(task);
    model.progress[id] = 0;
    model.details[id] = { task, analysis: { state: "pending", updated_at: time(0) }, production: null, log: { id: task.log_id } };
  }
  return model;
}
export function advanceSimulation(previous: Simulation): Simulation {
  const next = structuredClone(previous);
  next.tick++;
  if (next.tick < 2) return next;
  next.data.sync.running = false;
  next.data.tasks.forEach((task, index) => {
    if (!["pending", "running"].includes(task.state)) return;
    const detail = next.details[task.id], example = examples[index % examples.length];
    const progress = ++next.progress[task.id], analysisEnd = 4 + index, end = analysisEnd + 7 + index;
    const stamp = time(next.tick);
    task.state = "running";
    task.updated_at = stamp;
    if (progress <= analysisEnd) {
      detail.analysis = {
        state: "running", updated_at: stamp, topic: example.topic,
        analysis: progress < 3 ? "최근 제작 기록에서 저장 반응과 제공한 답을 비교하고 있습니다." : "바로 적용할 수 있는 답을 짧게 제시한 사례를 참고했습니다. 저장 반응은 실행 편의성과 관련이 있다고 추정합니다.",
        ...(progress >= 2 ? { answer: example.answer, reason: "최근 콘텐츠와 다른 조건에서 바로 실행할 답을 제공한다.", content_type: example.type } : {}),
        ...(progress >= 3 ? { presentation: "짧은 훅 뒤에 운동 이미지와 간결한 실행 정보를 배치한다.", expected_response: "필요할 때 다시 보기 위한 저장", goal_connection: "운동 결정을 간단하게 맡기려는 사람에게 앱의 가치를 전달한다.", difference_from_recent: example.answer } : {}),
        research: [{ question: "독자가 지금 바로 실행할 수 있는 답은 무엇인가?", source: "mock-reference", finding: progress > 2 ? "한눈에 읽는 실행 정보가 반복해서 사용됐다." : "사례를 비교하고 있습니다.", judgment: "정보량을 줄이고 적용 조건을 분명히 한다." }],
        sources: [{ kind: "log", id: "mock-history", part: "훅·본문", used_for: "설명보다 실행할 답을 먼저 제시" }],
        completed_actions: progress > 2 ? ["최근 제작 기록 확인", "참고 사례 비교"] : ["최근 제작 기록 확인"], remaining_actions: ["제작 방향 확정"],
      };
      next.activity[task.id] = progress < 3 ? "과거 기록·레퍼런스 비교" : "제작 방향 정리·저장";
    } else {
      task.current_step = "production";
      task.project_id = `mock-post-${task.id.slice("mock-task-".length)}`;
      detail.analysis.state = "completed";
      detail.analysis.remaining_actions = [];
      const written = Math.min(4, progress - analysisEnd);
      detail.production = { state: "running", updated_at: stamp,
        content: { hook: example.hook, slides: [
          { role: "hook", text: example.hook },
          ...(written >= 2 ? [{ role: "body", text: example.answer }] : []),
          ...(written >= 3 ? [{ role: "body", text: "운동 이미지와 세트·횟수 정보 배치" }] : []),
          ...(written >= 4 ? [{ role: "cta", text: "YOUR PLAN. YOUR PACE. LIFTCODE." }] : []),
        ] }, sources: detail.analysis.sources,
        completed_actions: ["훅 작성", ...(written >= 2 ? ["본문 구성"] : []), ...(written >= 4 ? ["CTA 작성"] : [])],
        remaining_actions: written >= 4 ? ["전체 슬라이드 미리보기 확인", "최종 저장"] : ["본문 작성", "이미지 배치", "전체 장 검토"],
      };
      next.activity[task.id] = written < 4 ? `슬라이드 ${written}/4 작성·저장` : "전체 슬라이드 검토·저장";
      if (next.withFailure && index === 2 && progress === analysisEnd + 3 && !next.failedOnce.includes(task.id)) {
        task.state = "failed";
        detail.production.state = "failed";
        detail.production.error = "미리보기용 오류: 이미지 조회 실패. 재개하면 이어서 진행합니다.";
        next.failedOnce.push(task.id);
      } else if (progress >= end) {
        task.state = "finished";
        detail.production.state = "completed";
        detail.production.remaining_actions = [];
        next.activity[task.id] = "제작 완료";
        next.data.logs.unshift({ id: task.log_id, name: example.topic, topic: example.topic, content_type: example.type, message: example.answer, project_id: task.project_id, actual_summary: detail.production.content, completed_at: null });
      }
    }
    const key = `${task.id}:${task.current_step}`;
    next.writes[key] = (next.writes[key] ?? 0) + 1;
    detail.task = task;
  });
  return next;
}
export function mockAction(previous: Simulation, input: Record<string, unknown>): Simulation {
  const next = structuredClone(previous), id = String(input.id ?? "");
  const task = next.data.tasks.find(task => task.id === id);
  if (input.action === "settings") next.data.settings.model = String((input.settings as Row).model);
  else if (input.action === "stop" || input.action === "resume") {
    if (task) {
      task.state = input.action === "stop" ? "stopped" : "running";
      const context = task.current_step === "analysis" ? next.details[id].analysis : next.details[id].production;
      if (context) { context.state = task.state; delete context.error; }
    }
  } else if (input.action === "remove") {
    next.data.tasks = next.data.tasks.filter(task => task.id !== id);
    delete next.details[id]; delete next.progress[id];
  } else if (input.action === "edit_log") {
    const log = next.data.logs.find(log => log.id === id);
    if (log) Object.assign(log, input.patch);
  } else if (input.action === "register") {
    const log = next.data.logs.find(log => log.id === id);
    if (log) Object.assign(log, { post_url: input.url, completed_at: time(next.tick), actual_published_at: time(next.tick) });
  } else if (input.action === "reference") {
    next.data.references.push({ ...(input.reference as Row), id: `mock-reference-${next.data.references.length + 1}` });
  } else if (input.action === "remove_reference") next.data.references = next.data.references.filter(ref => ref.id !== id);
  return next;
}
