import { ResultDelivery, type ResultTarget } from "../results/delivery";
import { randomUUID } from "node:crypto";
import { draftId, draftNumber } from "../../persistence/draft-numbers";
import type { productionStore, stopProduction, execute, resetProduction } from "../../execution/runner";
import type { TelegramClient } from "../client";
import type { TelegramStore } from "../store";

type Job = { id: string; number?: number; chat: string; notified: boolean; generation?: string };
const states: Record<string, string> = { pending: "대기", running: "진행 중", finished: "완료", failed: "실패", stopped: "중단" };
const steps: Record<string, string> = { analysis: "분석", production: "초안 제작", hook: "훅 검토", polish: "영어 교정", visual: "시각 검수" };

export class TelegramJobs {
  private delivering=new Set<string>();
  constructor(private readonly client: TelegramClient, private readonly state: TelegramStore,
    private readonly user: string, private readonly origin: string,
    private readonly services: { store: typeof productionStore; stop: typeof stopProduction },
    private readonly lifecycle: { resume: typeof execute; reset: typeof resetProduction }, private readonly delivery?:ResultDelivery) {}

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
    const store = this.services.store();
    const id = draftId(store.db, number);
    if (store.get(id).task.state === "finished") throw new Error("완료된 작업은 중단할 수 없습니다.");
    this.services.stop(id);
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

  async sendResult(id:string) {
    const task=this.services.store().get(id).task;
    if(task.state!=="finished" || !task.project_id) throw new Error("완성된 작업만 받을 수 있습니다.");
    if(!this.delivery) throw new Error("결과 전송이 준비되지 않았습니다.");
    await this.delivery.images({draftId:id,projectId:task.project_id,number:draftNumber(this.services.store().db,id)});
  }
  async notify() {
    // Includes jobs started in the desktop UI, not only /create.
    for(const task of this.services.store().list()) {
      if(task.state!=="finished" || !task.project_id || !this.delivery || this.delivering.has(task.id)) continue;
      const key=`delivered:${task.id}`;
      const progress=this.state.get<{images:number;copy:boolean;retryAt?:number;done?:boolean}>(key) ?? {images:0,copy:false};
      if(progress.done || (progress.retryAt ?? 0)>Date.now()) continue;
      this.delivering.add(task.id);
      const target:ResultTarget={draftId:task.id,projectId:task.project_id,number:draftNumber(this.services.store().db,task.id)};
      void (async()=>{
        try {
          await this.delivery!.images(target,progress.images,count=>{progress.images=count;this.state.set(key,progress);});
          if(!progress.copy) {
            try {await this.delivery!.text(target,await this.delivery!.copy(target));}
            catch {await this.client.send(this.user,`job ${target.number} - 이미지는 전송했습니다. 게시 문구 생성·전송에 실패했습니다. 이미지에 답장해 문구를 다시 요청해 주세요.`);}
            progress.copy=true;
          }
          progress.done=true;this.state.set(key,progress);
        } catch {
          progress.retryAt=Date.now()+60_000;this.state.set(key,progress);
          console.error(`텔레그램 결과 전송 재시도 대기: job ${target.number}`);
        } finally {this.delivering.delete(task.id);}
      })();
    }
    const jobs = this.state.get<Job[]>("jobs") ?? [];
    const tasks = new Map(this.services.store().list().map(task => [task.id, task]));
    for (const job of jobs.filter(job => !job.notified)) {
      const task = tasks.get(job.id);
      if (task && !["finished", "failed", "stopped"].includes(task.state)) continue;
      if (!(task?.state === "finished" && this.delivery)) await this.client.send(job.chat, task ? this.result(job.id) : `작업${job.number ? ` #${job.number}` : ""}이 앱에서 정리되었습니다.`);
      // Read again after network I/O so a concurrent start/resume/reset is preserved.
      const current = this.state.get<Job[]>("jobs") ?? [];
      const record = current.find(record => record.id === job.id);
      if (!record || record.generation !== job.generation) continue;
      record.notified = true;
      this.state.set("jobs", current);
    }
  }
}
