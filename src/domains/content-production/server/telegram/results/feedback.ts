import { setTimeout as delay } from "node:timers/promises";
import { loadContentProject } from "@/domains/slideshow/projects/service";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { assistantStatus, startAssistant, stopAssistant } from "@/domains/workspace/assistant/server/service";
import type { AssistantTarget } from "@/domains/workspace/assistant/model";
import type { ProductionStore } from "../../persistence/store";
import type { TelegramClient } from "../client";
import type { TelegramStore } from "../store";
import { ResultDelivery, type ResultTarget } from "./delivery";

/** Telegram and editor commands use the same per-tab assistant lock and latest snapshot. */
export class TelegramFeedback {
  private queues=new Map<string,Promise<void>>();
  private epochs=new Map<string,number>();
  private active=new Map<string,AssistantTarget>();
  constructor(private delivery:ResultDelivery,private client:TelegramClient,private state:TelegramStore,
    private user:string,private origin:string,private store:()=>ProductionStore,
    private assistant={
      load:async(projectId:string):Promise<AssistantTarget>=>{
        await loadContentProject(contentJobRegistry,projectId);
        return {projectId,tabId:contentJobRegistry.get(projectId).tabId,projectType:"slideshow"};
      },start:startAssistant,status:assistantStatus,stop:stopAssistant,
    }) {}
  request(target:ResultTarget,message:string,requestId:string,slideId?:string,mode:"conversation"|"edit"|"copy"="conversation") {
    this.assertEditable(target);
    const epoch=this.epochs.get(target.projectId) ?? 0;
    const previous=this.queues.get(target.projectId) ?? Promise.resolve();
    const next=previous.catch(()=>{}).then(()=>{
      if(epoch!==(this.epochs.get(target.projectId) ?? 0)) throw new Error("수정 요청이 중단되었습니다.");
      return this.execute(target,message,requestId,slideId,mode);
    });
    this.queues.set(target.projectId,next);
    void next.catch(async error=>{
      await this.client.send(this.user,error instanceof Error ? error.message : "수정 요청 처리 실패");
    }).catch(()=>console.error("텔레그램 피드백 결과 전송 실패"));
    void next.finally(()=>{if(this.queues.get(target.projectId)===next)this.queues.delete(target.projectId);}).catch(()=>{});
  }
  busy(projectId:string) {
    if(this.queues.has(projectId)) return true;
    let tabId:string;
    try {tabId=contentJobRegistry.get(projectId).tabId;} catch {return false;}
    return this.assistant.status({projectId,tabId,projectType:"slideshow"}).state==="running";
  }
  stop(projectId:string) {
    this.epochs.set(projectId,(this.epochs.get(projectId) ?? 0)+1);
    const target=this.active.get(projectId);
    if(target) this.assistant.stop(target.tabId);
  }
  private assertEditable(target:ResultTarget) {
    if (!target.draftId) throw new Error("게시된 글은 조회만 가능합니다. 완성 draft에 답장해 주세요.");
    const task=this.store().get(target.draftId).task;
    if(task.state!=="finished" || task.project_id!==target.projectId) throw new Error("제작이 완료된 현재 draft만 수정할 수 있습니다.");
  }
  private async execute(target:ResultTarget,message:string,requestId:string,slideId:string|undefined,mode:"conversation"|"edit"|"copy") {
    this.assertEditable(target);
    const key=`feedback:${requestId}`;
    if(this.state.get(key)) return;
    this.state.set(key,"running"); // Never replay an uncertain edit after a server restart.
    let editor:AssistantTarget | undefined;
    try {
      if(mode==="copy") {
        await this.delivery.text(target,await this.delivery.copy(target));
        this.state.set(key,"completed");return;
      }
      editor=await this.assistant.load(target.projectId);
      const deadline=Date.now()+21*60_000;
      while(this.assistant.status(editor).state==="running") {
        this.assertEditable(target);
        if(Date.now()>deadline) throw new Error("편집기가 사용 중입니다. 잠시 후 다시 요청해 주세요.");
        await delay(500);
      }
      this.assistant.start(editor,slideId ? {slideIds:[slideId]} : {},mode==="edit" ? `This is a slide-edit-only command. Apply slide changes requested below. For publishing copy requests, answer only with guidance to use /copy [job number]; do not generate publishing copy. User request: ${message}` : message,requestId,this.origin);
      this.active.set(target.projectId,editor);
      while(this.assistant.status(editor).state==="running") {
        try {this.assertEditable(target);} catch(error) {this.assistant.stop(editor.tabId);throw error;}
        if(Date.now()>deadline) {this.assistant.stop(editor.tabId);throw new Error("수정 시간이 초과되었습니다. 최신 저장본을 확인해 주세요.");}
        await delay(500);
      }
      const status=this.assistant.status(editor);
      this.assertEditable(target);
      if(status.state!=="completed") throw new Error(status.error || "수정이 완료되지 않았습니다.");
      if(status.changed) await this.delivery.images(target);
      if(status.text && (mode!=="edit" || !status.changed)) await this.delivery.text(target,mode==="edit" ? `게시 문구는 /copy ${target.number} 으로 요청해 주세요. 슬라이드를 수정하려면 수정할 내용을 입력해 주세요.` : status.text);
      this.state.set(key,"completed");
    } catch(error) {
      this.state.set(key,"failed");
      throw error;
    } finally {this.active.delete(target.projectId);}
  }
}
