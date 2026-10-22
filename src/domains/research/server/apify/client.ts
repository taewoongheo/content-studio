import { socialSource } from "../../domain/source";
import { z } from "zod";
const itemSchema=z.object({
 id:z.string(), webVideoUrl:z.string().optional(), submittedVideoUrl:z.string().optional(), text:z.string().optional(),
 createTimeISO:z.string().optional(), createTime:z.number().optional(),
 playCount:z.number().nonnegative().nullable().optional(), diggCount:z.number().nonnegative().nullable().optional(),
 commentCount:z.number().nonnegative().nullable().optional(), collectCount:z.number().nonnegative().nullable().optional(), shareCount:z.number().nonnegative().nullable().optional(),
 slideshowImageLinks:z.array(z.string()).optional(),
 imagePost:z.object({images:z.array(z.object({imageURL:z.object({urlList:z.array(z.string())}).optional(),urlList:z.array(z.string()).optional()}))}).optional(),
}).passthrough();
export function normalizeTikTokUrl(raw:string) {
 const source=socialSource(raw,"post");if(source.platform!=="tiktok")throw new Error("현재 게시 연결은 TikTok URL을 지원합니다.");return source;
}
export function parseApifyItem(raw:unknown) {
 const item=itemSchema.parse(raw);
 const timestamp=item.createTimeISO ? Date.parse(item.createTimeISO) : item.createTime ? item.createTime*1000 : NaN;
 return {id:item.id,text:item.text??"",url:item.webVideoUrl??item.submittedVideoUrl??null,
  published_at:Number.isFinite(timestamp)?new Date(timestamp).toISOString():null,
  images:item.slideshowImageLinks??item.imagePost?.images.map(i=>(i.imageURL?.urlList??i.urlList??[])[0]).filter(Boolean)??[],
  view_count:item.playCount??null,like_count:item.diggCount??null,comment_count:item.commentCount??null,save_count:item.collectCount??null,share_count:item.shareCount??null};
}
export type ApifyPost=ReturnType<typeof parseApifyItem>;
export class ApifyTikTokClient {
 constructor(private token=process.env.APIFY_API_TOKEN,private transport:typeof fetch=fetch) {}
 async run(input:Record<string,unknown>,signal?:AbortSignal) {
  if(!this.token)throw new Error("서버의 APIFY_API_TOKEN을 설정해 주세요.");
  const response=await this.transport("https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?timeout=240&format=json&clean=true",{
   method:"POST",headers:{Authorization:`Bearer ${this.token}`,"Content-Type":"application/json"},
   body:JSON.stringify({shouldDownloadVideos:false,shouldDownloadSlideshowImages:false,scrapeRelatedVideos:false,...input}),
   signal:signal?AbortSignal.any([signal,AbortSignal.timeout(250000)]):AbortSignal.timeout(250000),cache:"no-store"});
  if(!response.ok)throw new Error(`Apify 수집 실패 (${response.status}). 키·크레딧·Actor 상태를 확인해 주세요.`);
  const result:unknown=await response.json();if(!Array.isArray(result))throw new Error("Apify의 게시물 배열을 확인할 수 없습니다.");
  return result.map(parseApifyItem);
 }
 async posts(urls:string[],signal?:AbortSignal) {
  if(!urls.length)return [];
  const normalized=urls.map(normalizeTikTokUrl);
  const items=await this.run({postURLs:normalized.map(s=>s.url),resultsPerPage:urls.length},signal);
  return normalized.map(source=>{const item=items.find(i=>i.id===source.id);if(!item)throw new Error(`게시물을 조회하지 못했습니다: ${source.url}`);return {...item,url:source.url};});
 }
 async search(query:string,limit:number,signal?:AbortSignal) {
  return this.run({searchQueries:[query],searchSection:"/video",resultsPerPage:limit},signal);
 }
}
