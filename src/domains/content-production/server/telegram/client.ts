import { request } from "node:https";

export type Buttons = Array<Array<{text:string;callback_data?:string;url?:string}>>;
export class TelegramClient {
  constructor(private readonly token: string) {}
  private async request<T>(method: string, body: Uint8Array, contentType:string, timeout=40000): Promise<T> {
    const result = await new Promise<{ok:boolean;result:T;error_code?:number;description?:string}>((resolve,reject)=> {
      const fail=()=>reject(new Error("텔레그램 연결 실패. 자동 재연결합니다."));
      const req=request(`https://api.telegram.org/bot${this.token}/${method}`,{
        method:"POST",family:4,headers:{"Content-Type":contentType},
      },response=> {
        let data="";
        response.setEncoding("utf8");
        response.on("data",chunk=> {
          data+=chunk;
          if(data.length>8*1024*1024) req.destroy(new Error("Response too large"));
        });
        response.on("error",fail);
        response.on("end",()=> {
          try {resolve(JSON.parse(data));} catch {fail();}
        });
      });
      const timer=setTimeout(()=>req.destroy(new Error("Timeout")),timeout);
      req.on("close",()=>clearTimeout(timer));
      req.on("error",fail);
      req.end(body);
    });
    if (!result.ok) {
      const reason=(result.description ?? "사유 없음").replaceAll(this.token,"[redacted]");
      throw new Error(`텔레그램 요청 실패 (${result.error_code ?? "unknown"}): ${reason}`);
    }
    return result.result;
  }
  call<T>(method:string,body:object):Promise<T> {
    return this.request(method,Buffer.from(JSON.stringify(body)),"application/json");
  }
  async upload<T>(method: string, form: FormData): Promise<T> {
    const encoded=new Response(form);
    return this.request(method,new Uint8Array(await encoded.arrayBuffer()),encoded.headers.get("content-type")!,120000);
  }
  async photos(chat: string, photos: Array<{bytes:Buffer;caption:string}>) {
    const form = new FormData();
    form.set("chat_id",chat);
    photos.forEach((photo,index)=>form.set(`photo${index}`,new Blob([new Uint8Array(photo.bytes)],{type:"image/png"}),`slide-${index+1}.png`));
    if (photos.length === 1) {
      form.set("photo","attach://photo0"); form.set("caption",photos[0].caption);
      return [await this.upload<{message_id:number}>("sendPhoto",form)];
    }
    form.set("media",JSON.stringify(photos.map((photo,index)=>({type:"photo",media:`attach://photo${index}`,caption:photo.caption}))));
    return this.upload<Array<{message_id:number}>>("sendMediaGroup",form);
  }
  async linkedText(chat: string, text: string, linked: (id:number)=>void) {
    const chars=Array.from(text);
    for (let i=0;i<chars.length;i+=1800) {
      const result=await this.call<{message_id:number}>("sendMessage",{chat_id:chat,text:chars.slice(i,i+1800).join(""),link_preview_options:{is_disabled:true}});
      linked(result.message_id);
    }
  }
  async send(chat: string, text: string, buttons?: Buttons) {
    const parts = Array.from(text);
    for (let i=0;i<parts.length;i+=1800) {
      await this.call("sendMessage", {chat_id:chat,text:parts.slice(i,i+1800).join(""),
        link_preview_options:{is_disabled:true},
        ...(i+1800>=parts.length && buttons ? {reply_markup:{inline_keyboard:buttons}} : {}),
      });
    }
  }
}
