import { randomUUID } from "node:crypto";
import { draftId, draftNumber } from "../../persistence/draft-numbers";
import type { productionStore, stopProduction, execute, resetProduction } from "../../execution/runner";
import type { TelegramClient } from "../client";
import type { TelegramStore } from "../store";

type Job = { id: string; number?: number; chat: string; notified: boolean; generation?: string };
const states: Record<string, string> = { pending: "대기", running: "진행 중", finished: "완료", failed: "실패", stopped: "중단" };
const steps: Record<string, string> = { analysis: "분석", production: "초안 제작", hook: "훅 검토", polish: "영어 교정", visual: "시각 검수" };

export class TelegramJobs {
  constructor(private readonly client: TelegramClient, private readonly state: TelegramStore,
    private readonly user: string, private readonly origin: string,
    private readonly services: { store: typeof productionStore; stop: typeof stopProduction },
    private readonly lifecycle: { resume: typeof execute; reset: typeof resetProduction }) {}

  track(id: string) {
    const jobs = this.state.get<Job[]>("jobs") ?? [];
    this.state.set("jobs", [...jobs.filter(job => job.id !== id), {
      id, number: draftNumber(this.services.store().db, id), chat: this.user, notified: false, generation: randomUUID(),
    }]);
  }

  list(preparing: boolean) {
    const store = this.services.store();
    const tasks = store.list().map(task => ({ task, number: draftNumber(store.db, task.id) }))
      .sort((a, b) => a.number - b.number);
    return tasks.length ? tasks.map(({ task, number }) => `job ${number} - ${states[task.state] ?? task.state}`).join("\n")
      : preparing ? "분석 자료를 준비 중입니다." : "현재 제작 작업이 없습니다.";
  }

  stop(number: string) {
    this.services.stop(draftId(this.services.store().db, number));
  }

  async resume(number: string) {
    const store = this.services.store();
    const id = draftId(store.db, number);
    if (!["stopped", "failed"].includes(store.get(id).task.state))
      throw new Error("중단·실패한 작업만 재개할 수 있습니다.");
    this.track(id);
    void this.lifecycle.resume(id, this.origin).catch(error => {
      // Reset may have removed this draft while the execution was unwinding.
      if (store.list().some(task => task.id === id))
        store.state(id, "failed", error instanceof Error ? error.message : "재개 실패");
    }).catch(() => console.error("텔레그램 작업 재개 실패 상태 저장 오류"));
    await this.client.send(this.user, `job ${number} - 재개`);
  }

  async reset() {
    this.lifecycle.reset();
    this.state.set("pending", null);
    this.state.set("jobs", []);
    await this.client.send(this.user, "전체 제작 작업을 초기화했습니다.");
  }

  private result(id: string) {
    const store = this.services.store();
    const detail = store.get(id);
    const content = detail.log.content_summary ?? detail.production?.content;
    const summary = content && typeof content === "object" ? Object.entries(content)
      .filter(([key, value]) => ["title", "caption", "summary"].includes(key) && typeof value === "string")
      .map(([, value]) => String(value)).join("\n\n") : "";
    const error = detail[detail.task.current_step]?.error as { message?: string } | undefined;
    return [`작업 #${draftNumber(store.db, id)}`,
      `${states[detail.task.state] ?? detail.task.state} · ${steps[detail.task.current_step] ?? detail.task.current_step}`,
      detail.task.topic, detail.log.message, summary || detail.log.answer, error?.message,
      detail.task.project_id ? `프로젝트: ${detail.task.project_id}` : ""].filter(Boolean).join("\n");
  }

  async notify() {
    const jobs = this.state.get<Job[]>("jobs") ?? [];
    const tasks = new Map(this.services.store().list().map(task => [task.id, task]));
    for (const job of jobs.filter(job => !job.notified)) {
      const task = tasks.get(job.id);
      if (task && !["finished", "failed", "stopped"].includes(task.state)) continue;
      await this.client.send(job.chat, task ? this.result(job.id) : `작업${job.number ? ` #${job.number}` : ""}이 앱에서 정리되었습니다.`);
      // Read again after network I/O so a concurrent start/resume/reset is preserved.
      const current = this.state.get<Job[]>("jobs") ?? [];
      const record = current.find(record => record.id === job.id);
      if (!record || record.generation !== job.generation) continue;
      record.notified = true;
      this.state.set("jobs", current);
    }
  }
}
