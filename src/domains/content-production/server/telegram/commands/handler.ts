import { draftNumber } from "../../persistence/draft-numbers";
import { TelegramJobs } from "./jobs";
import { requestFromText, sendSources } from "./sources";
import { productionModeLabels, productionRequestSchema, type ProductionRequest } from "../../../domain/start/input";
import { productionStore, startProduction, stopProduction, execute, resetProduction } from "../../execution/runner";
import { authorized, command, HELP, type TelegramUpdate } from "../protocol";
import { TelegramClient } from "../client";
import { TelegramStore } from "../store";

type Pending = {id:string;request:ProductionRequest};
export class TelegramHandler {
  private preparing=false;
  private readonly jobs: TelegramJobs;
  constructor(private readonly client:TelegramClient, private readonly state:TelegramStore,
    private readonly user:string, private readonly origin:string,
    private readonly services={store:productionStore,start:startProduction,stop:stopProduction},
    lifecycle={resume:execute,reset:resetProduction}) {
    this.jobs=new TelegramJobs(client,state,user,origin,services,lifecycle);
  }
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
        ids.forEach(id=>this.jobs.track(id));
        await this.client.send(this.user,ids.map(id=>`${draftNumber(this.services.store().db,id)}번 작업을 시작했습니다.`).join("\n"));
      } catch(error) {
        await this.client.send(this.user,error instanceof Error ? error.message : "제작 시작 실패");
      } finally {this.preparing=false;}
    })().catch(()=>console.error("텔레그램 제작 접수 결과 전송 실패. /job으로 확인해 주세요."));
  }
  async notify() { await this.jobs.notify(); }
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
        const request=requestFromText(store,args);
        this.state.set("pending",null);
        await this.start(request);
      } else if(name==="posts" || name==="refs") {
        await sendSources(this.client,this.state,this.user,store,name,args);
      } else if(name==="status") {
        await this.client.send(this.user,"서버 연결 정상.");
      } else if(name==="job") {
        await this.client.send(this.user,this.jobs.list(this.preparing));
      } else if(name==="resume") {
        await this.jobs.resume(args);
      } else if(name==="reset") {
        if(this.preparing) throw new Error("분석 자료 준비가 끝난 뒤 초기화해 주세요.");
        await this.jobs.reset();
      }
      else if(name==="stop") {
        if(args) this.jobs.stop(args);
        else this.state.set("pending",null);
        await this.client.send(this.user,args ? `${args}번 작업을 중단했습니다.` : "선택을 취소했습니다.");
      } else await this.client.send(this.user,HELP);
    } catch(error) {
      await this.client.send(this.user,error instanceof Error ? error.message : "요청 처리에 실패했습니다.");
    }
  }
}
