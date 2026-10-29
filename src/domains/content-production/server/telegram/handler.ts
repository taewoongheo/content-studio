import { draftId, draftNumber } from "../persistence/draft-numbers";
import { productionModeLabels, productionRequestSchema, type ProductionRequest } from "../../domain/start/input";
import { productionStore, startProduction, stopProduction, execute, resetProduction } from "../execution/runner";
import { externalReferences } from "../references/library";
import { authorized, command, createRequest, HELP, type TelegramUpdate } from "./protocol";
import { TelegramClient } from "./client";
import { TelegramStore } from "./store";

type Pending = {id:string;request:ProductionRequest};
type Job = {id:string;number?:number;chat:string;notified:boolean};
const states:Record<string,string>={pending:"대기",running:"진행 중",finished:"완료",failed:"실패",stopped:"중단"};
const steps:Record<string,string>={analysis:"분석",production:"초안 제작",hook:"훅 검토",polish:"영어 교정",visual:"시각 검수"};
export class TelegramHandler {
  private preparing=false;
  constructor(private readonly client:TelegramClient, private readonly state:TelegramStore,
    private readonly user:string, private readonly origin:string,
    private readonly services={store:productionStore,start:startProduction,stop:stopProduction},
    private readonly lifecycle={resume:execute,reset:resetProduction}) {}
  private async start(request:ProductionRequest) {
    if(this.preparing) throw new Error("분석 자료를 준비 중입니다. 잠시 후 다시 요청해 주세요.");
    const parsed=productionRequestSchema.parse(request);
    const store=this.services.store();
    store.requestSource(parsed);
    if(store.hasOpenDrafts()) throw new Error("기존 제작 작업이 남아 있습니다. 앱에서 기존 작업을 정리한 뒤 시작해 주세요.");
    await this.client.send(this.user,`${productionModeLabels[parsed.mode]} 접수. 분석 자료를 준비합니다.${parsed.instructions ? `\n추가요청: ${parsed.instructions}` : ""}`);
    this.preparing=true;
    void (async()=> {
      try {
        const ids=await this.services.start([parsed],this.origin);
        const jobs=this.state.get<Job[]>("jobs") ?? [];
        this.state.set("jobs",[...jobs,...ids.map(id=>({id,number:draftNumber(this.services.store().db,id),chat:this.user,notified:false}))]);
        await this.client.send(this.user,ids.map(id=>`${draftNumber(this.services.store().db,id)}번 작업을 시작했습니다.`).join("\n"));
      } catch(error) {
        await this.client.send(this.user,error instanceof Error ? error.message : "제작 시작 실패");
      } finally {this.preparing=false;}
    })().catch(()=>console.error("텔레그램 제작 접수 결과 전송 실패. /job으로 확인해 주세요."));
  }
  private result(id:string) {
    const detail=this.services.store().get(id);
    const content=detail.log.content_summary ?? detail.production?.content;
    const summary=content && typeof content === "object" ? Object.entries(content)
      .filter(([key,value])=>["title","caption","summary"].includes(key) && typeof value === "string")
      .map(([,value])=>String(value)).join("\n\n") : "";
    const error=detail[detail.task.current_step]?.error as {message?:string}|undefined;
    return [`작업 #${draftNumber(this.services.store().db,id)}`,`${states[detail.task.state] ?? detail.task.state} · ${steps[detail.task.current_step] ?? detail.task.current_step}`,
      detail.task.topic,detail.log.message,summary || detail.log.answer,error?.message,
      detail.task.project_id ? `프로젝트: ${detail.task.project_id}` : ""].filter(Boolean).join("\n");
  }
  async notify() {
    const jobs=this.state.get<Job[]>("jobs") ?? [];
    for(const job of jobs.filter(job=>!job.notified)) {
      const task=this.services.store().list().find(task=>task.id===job.id);
      if(!task || ["finished","failed","stopped"].includes(task.state)) {
        await this.client.send(job.chat,task ? this.result(job.id) : `작업${job.number ? ` #${job.number}` : ""}이 앱에서 정리되었습니다.`);
        job.notified=true;
        this.state.set("jobs",jobs);
      }
    }
  }
  async handle(update:TelegramUpdate) {
    if(!authorized(update,this.user) || !this.state.claim(update.update_id)) return;
    try {
      const callback=update.callback_query;
      if(callback) {
        await this.client.call("answerCallbackQuery",{callback_query_id:callback.id});
        const [action,id]= (callback.data ?? "").split(":");
        if(action==="pick") {
          const request=this.state.readChoice(id);
          this.state.set("pending",{id,request});
          await this.client.send(this.user,`${productionModeLabels[request.mode]} 선택. 추가요청을 입력해 주세요.`,[
            [{text:"추가요청 없이 시작",callback_data:`go:${id}`}],
            [{text:"취소",callback_data:`clear:${id}`}],
          ]);
        } else if(action==="go" || action==="clear") {
          const pending=this.state.get<Pending|null>("pending");
          if(!pending || pending.id!==id) throw new Error("현재 선택과 다른 버튼입니다. 자료를 다시 선택해 주세요.");
          this.state.readChoice(id);
          this.state.set("pending",null);
          if(action==="go") await this.start(pending.request);
          else await this.client.send(this.user,"선택을 취소했습니다.");
        }
        return;
      }
      const text=update.message?.text ?? "", parsed=command(text);
      if(!parsed) {
        const pending=this.state.get<Pending|null>("pending");
        if(!pending || !text.trim()) {await this.client.send(this.user,HELP);return;}
        this.state.readChoice(pending.id);
        this.state.set("pending",null);
        await this.start({...pending.request,instructions:text});return;
      }
      const {name,args}=parsed,store=this.services.store();
      if(name==="create") {
        const request=createRequest(args,url=> {
          const post=store.logs().find(row=>row.post_url===url && row.project_id);
          if(post) return {mode:"past_post",sourceProjectId:String(post.project_id),instructions:""};
          const ref=externalReferences(store.db).find(row=>row.url===url);
          return ref ? {mode:"spy_reference",referenceId:String(ref.id),instructions:""} : undefined;
        });
        this.state.set("pending",null);
        await this.start(request);
      } else if(name==="posts" || name==="refs") {
        const rows=name==="posts" ? store.logs(args).filter(row=>row.actual_published_at && row.project_id)
          .sort((a,b)=>String(b.actual_published_at).localeCompare(String(a.actual_published_at))) : externalReferences(store.db,args);
        if(!rows.length) await this.client.send(this.user,"검색 결과가 없습니다.");
        for(const row of rows.slice(0,5)) {
          const request:ProductionRequest=name==="posts" ? {mode:"past_post",sourceProjectId:String(row.project_id),instructions:""} : {mode:"spy_reference",referenceId:String(row.id),instructions:""};
          const id=this.state.choice(request),url=String(row.post_url ?? row.url ?? "");
          await this.client.send(this.user,[row.name ?? row.title ?? row.topic ?? "게시글",row.topic,row.content_type,url].filter(Boolean).join("\n"),[
            [{text:"이 자료로 제작",callback_data:`pick:${id}`}],
          ]);
        }
        if(rows.length>5) await this.client.send(this.user,`총 ${rows.length}개 중 5개입니다. 검색어로 범위를 좁혀 주세요.`);
      } else if(name==="status") {
        await this.client.send(this.user,"서버 연결 정상.");
      } else if(name==="job") {
        const tasks=store.list().sort((a,b)=>draftNumber(store.db,a.id)-draftNumber(store.db,b.id));
        await this.client.send(this.user,tasks.length ? tasks.map(task=> {
          const number=draftNumber(store.db,task.id);
          return `job ${number} - ${states[task.state] ?? task.state}`;
        }).join("\n") : this.preparing ? "분석 자료를 준비 중입니다." : "현재 제작 작업이 없습니다.");
      }

      else if(name==="resume") {
        const id=draftId(store.db,args),task=store.get(id).task;
        if(!["stopped","failed"].includes(task.state)) throw new Error("중단·실패한 작업만 재개할 수 있습니다.");
        void this.lifecycle.resume(id,this.origin).catch(error=> {
          store.state(id,"failed",error instanceof Error ? error.message : "재개 실패");
        });
        const jobs=this.state.get<Job[]>("jobs") ?? [];
        this.state.set("jobs",[...jobs.filter(job=>job.id!==id),{id,number:draftNumber(store.db,id),chat:this.user,notified:false}]);
        await this.client.send(this.user,`job ${args} - 재개`);
      } else if(name==="reset") {
        if(this.preparing) throw new Error("분석 자료 준비가 끝난 뒤 초기화해 주세요.");
        this.lifecycle.reset();
        this.state.set("pending",null);
        this.state.set("jobs",[]);
        await this.client.send(this.user,"전체 제작 작업을 초기화했습니다.");
      }
      else if(name==="stop") {
        if(args) this.services.stop(draftId(store.db,args));
        else this.state.set("pending",null);
        await this.client.send(this.user,args ? `${args}번 작업을 중단했습니다.` : "선택을 취소했습니다.");
      } else await this.client.send(this.user,HELP);
    } catch(error) {
      await this.client.send(this.user,error instanceof Error ? error.message : "요청 처리에 실패했습니다.");
    }
  }
}
