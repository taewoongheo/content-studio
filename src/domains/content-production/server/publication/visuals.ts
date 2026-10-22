import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { readSourceImage } from "@/domains/research/media/images";
import type { Row } from "../../domain/contracts";
export interface VisualSlide { data:Buffer; width:number; height:number }
export async function collectVisuals(urls:string[]):Promise<VisualSlide[]> {
 if(!urls.length)throw new Error("전체 슬라이드 이미지 URL이 반환되지 않았습니다.");
 const slides=[];
 for(const url of urls){
  const source=await readSourceImage(url);
  const {data,info}=await sharp(Buffer.from(source.data,"base64")).resize({width:540,withoutEnlargement:true}).webp({quality:82}).toBuffer({resolveWithObject:true});
  slides.push({data,width:info.width,height:info.height});
 }
 return slides;
}
export function saveVisuals(db:Database.Database,input:{kind:"reference"|"published";log_id?:string;url:string;slides:VisualSlide[]}) {
 if(!input.slides.length)throw new Error("전체 슬라이드가 필요합니다.");
 const existing=db.prepare("SELECT id FROM content_visual_sets WHERE kind=? AND source_url=?").get(input.kind,input.url) as {id:string}|undefined;
 if(existing)return existing.id;
 const id=randomUUID(),now=new Date().toISOString();
 db.transaction(()=>{
  db.prepare("INSERT INTO content_visual_sets VALUES(?,?,?,?,?,?,?)").run(id,input.kind,input.log_id??null,input.url,input.slides.length,now,now);
  const put=db.prepare("INSERT INTO content_visual_slides VALUES(?,?,'image/webp',?,?,?,?)");
  input.slides.forEach((slide,index)=>put.run(id,index,slide.width,slide.height,slide.data.length,slide.data));
 })();return id;
}
export function listVisuals(db:Database.Database) {return db.prepare("SELECT * FROM content_visual_sets ORDER BY created_at DESC").all() as Row[];}
