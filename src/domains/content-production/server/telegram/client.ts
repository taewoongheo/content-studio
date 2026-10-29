import { request } from "node:https";

export type Buttons = Array<Array<{text:string;callback_data?:string;url?:string}>>;
export class TelegramClient {
  constructor(private readonly token: string) {}
  async call<T>(method: string, body: object): Promise<T> {
    const result = await new Promise<{ok:boolean;result:T;error_code?:number}>((resolve,reject)=> {
      const fail=()=>reject(new Error("텔레그램 연결 실패. 자동 재연결합니다."));
      const req=request(`https://api.telegram.org/bot${this.token}/${method}`,{
        method:"POST",family:4,headers:{"Content-Type":"application/json"},
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
      const timer=setTimeout(()=>req.destroy(new Error("Timeout")),40000);
      req.on("close",()=>clearTimeout(timer));
      req.on("error",fail);
      req.end(JSON.stringify(body));
    });
    if (!result.ok) throw new Error(`텔레그램 요청 실패 (${result.error_code ?? "unknown"})`);
    return result.result;
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
