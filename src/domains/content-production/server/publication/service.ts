import type Database from "better-sqlite3";
import { ApifyTikTokClient, normalizeTikTokUrl, type ApifyPost } from "@/domains/research/server/apify/client";
import { collectVisuals, saveVisuals } from "./visuals";
import { publishChange } from "../events";
import type { Row } from "../../domain/contracts";
const metricsKeys=["view_count","like_count","comment_count","save_count","share_count"] as const;
export function updateMetrics(db:Database.Database,id:string,post:ApifyPost) {
 const now=new Date().toISOString();
 db.prepare(`UPDATE content_creation_logs SET ${metricsKeys.map(k=>`${k}=?`).join(",")},observed_at=?,updated_at=? WHERE id=?`).run(...metricsKeys.map(k=>post[k]),now,now,id);
}
export function recentKoreanDate(iso:string,now=new Date()) {
 const day=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
 const today=day(now),cutoff=day(new Date(now.getTime()-3*86400000)),published=day(new Date(iso));
 return published>=cutoff&&published<=today;
}
export async function refreshMetrics(db:Database.Database,signal?:AbortSignal,client=new ApifyTikTokClient()) {
 const targets=(db.prepare("SELECT id,post_url,actual_published_at FROM content_creation_logs WHERE post_url IS NOT NULL AND actual_published_at IS NOT NULL").all() as Array<{id:string;post_url:string;actual_published_at:string}>).filter(r=>recentKoreanDate(r.actual_published_at));
 if(!targets.length)return 0;
 const posts=await client.posts(targets.map(r=>r.post_url),signal);signal?.throwIfAborted();
 db.transaction(()=>targets.forEach((target,i)=>updateMetrics(db,target.id,posts[i])))();return targets.length;
}
const registrations=new Map<string,Promise<unknown>>();
export function registerPublication(db:Database.Database,logId:string,url:string) {
 if(registrations.has(logId))return registrations.get(logId)!;
 const promise=registerPost(db,logId,url).finally(()=>registrations.delete(logId));registrations.set(logId,promise);return promise;
}
async function registerPost(db:Database.Database,logId:string,raw:string) {
 const {url}=normalizeTikTokUrl(raw);
 const log=db.prepare("SELECT * FROM content_creation_logs WHERE id=?").get(logId) as Row|undefined;
 if(!log)throw new Error("로그를 찾을 수 없습니다.");
 if(log.completed_at){if(log.post_url!==url)throw new Error("이미 다른 게시물이 연결되어 있습니다.");return {completed:true};}
 const duplicate=db.prepare("SELECT id FROM content_creation_logs WHERE post_url=? AND id<>?").get(url,logId);
 if(duplicate)throw new Error("다른 콘텐츠에 연결된 URL입니다.");
 const task=db.prepare("SELECT state FROM content_drafts WHERE log_id=?").get(logId) as {state:string}|undefined;
 if(task&&task.state!=="finished")throw new Error("제작 종료 후 URL을 등록해 주세요.");
 const [post]=await new ApifyTikTokClient().posts([url]);
 if(!post.published_at)throw new Error("실제 게시 시각이 반환되지 않았습니다.");
 const slides=await collectVisuals(post.images);
 db.transaction(()=>{
  saveVisuals(db,{kind:"published",log_id:logId,url,slides});
  db.prepare("UPDATE content_creation_logs SET platform='tiktok',post_url=?,actual_published_at=?,completed_at=?,updated_at=? WHERE id=?").run(url,post.published_at,new Date().toISOString(),new Date().toISOString(),logId);
  updateMetrics(db,logId,post);
 })();publishChange({kind:"library"});return {completed:true};
}
