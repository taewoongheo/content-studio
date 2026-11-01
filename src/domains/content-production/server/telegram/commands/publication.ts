import { draftId } from "../../persistence/draft-numbers";
import { registerPublication } from "../../publication/service";
import type { ProductionStore } from "../../persistence/store";
import type { TelegramStore } from "../store";

/** Register an already uploaded post through the same service as the dashboard. */
export class TelegramPublication {
  private active=new Set<string>();
  constructor(private state:TelegramStore,private store:()=>ProductionStore,
    private register=registerPublication,private busy:(projectId:string)=>boolean=()=>false) {}
  isActive(projectId:string) {return this.active.has(projectId);}
  async publish(args:string,accepted:()=>Promise<void>) {
    const match=args.match(/^([1-9]\d*)\s+(https?:\/\/\S+)$/i);
    if(!match || !Number.isSafeInteger(Number(match[1])))
      throw new Error("예: /publish 1 https://www.tiktok.com/@계정/photo/게시글번호");
    const [,number,url]=match,store=this.store(),key=`publication:${number}`;
    let target=this.state.get<{logId:string;projectId:string}>(key);
    let id:string|undefined;
    try {id=draftId(store.db,number);} catch(error) {if(!target) throw error;}
    if(id) {
      const task=store.get(id).task;
      if(task.state!=="finished" || !task.project_id) throw new Error("제작이 완료된 draft만 게시 등록할 수 있습니다.");
      target={logId:task.log_id,projectId:task.project_id};
    }
    if(!target) throw new Error("게시할 작업을 찾을 수 없습니다.");
    if(this.active.has(target.projectId) || this.busy(target.projectId))
      throw new Error("현재 수정 또는 게시 등록 중입니다. 완료 후 다시 요청해 주세요.");
    this.active.add(target.projectId);
    try {
      // Preserve log ownership before the service removes the draft, so an explicit retry is safe.
      this.state.set(key,target);
      await accepted();
      await this.register(store.db,target.logId,url);
      return number;
    } finally {this.active.delete(target.projectId);}
  }
}
