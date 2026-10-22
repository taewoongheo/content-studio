import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function runCodex(input:{prompt:string;schema:unknown;origin:string;taskId:string;token:string;signal:AbortSignal;onActivity:(message:string)=>void}) {
 const directory=await mkdtemp(join(tmpdir(),"content-production-")),schema=join(directory,"output-schema.json"),output=join(directory,"result.json");
 try {
  await writeFile(schema,JSON.stringify(input.schema));input.signal.throwIfAborted();
  await new Promise<void>((resolve,reject)=>{
   const mcp=`{production={url=${JSON.stringify(`${input.origin}/api/content-production/agent/${input.taskId}`)},bearer_token_env_var="CONTENT_PRODUCTION_RUN_TOKEN"}}`;
   const child=spawn(process.env.CONTENT_STUDIO_CODEX_BIN||"codex",["exec","--json","--ephemeral","--sandbox","read-only","--output-schema",schema,"--output-last-message",output,"-c",`mcp_servers=${mcp}`,"-"],{
    cwd:process.cwd(),env:{...process.env,CONTENT_PRODUCTION_RUN_TOKEN:input.token},stdio:["pipe","pipe","pipe"],shell:false,detached:process.platform!=="win32",
   });
   let tail="",errorTail="";
   const kill=()=>{try{if(child.pid&&process.platform!=="win32")process.kill(-child.pid,"SIGTERM");else child.kill("SIGTERM");}catch{}};
   let force:ReturnType<typeof setTimeout>|undefined;
   const abort=()=>{kill();force=setTimeout(()=>{try{if(child.pid&&process.platform!=="win32")process.kill(-child.pid,"SIGKILL");else child.kill("SIGKILL");}catch{}},2000);};
   input.signal.addEventListener("abort",abort,{once:true});
   child.stdout.on("data",chunk=>{
    tail+=String(chunk);
    const lines=tail.split("\n");tail=lines.pop()!.slice(-65536);
    for(const line of lines){try{const event=JSON.parse(line);if(event.type==="item.started"||event.type==="item.completed")input.onActivity(event.item?.type??"작업 진행");}catch{}}
   });
   child.stderr.on("data",chunk=>{errorTail=(errorTail+String(chunk)).slice(-3000);});
   const finish=()=>{input.signal.removeEventListener("abort",abort);clearTimeout(force);};
   child.once("error",error=>{finish();reject(error);});
   child.once("close",code=>{finish();if(input.signal.aborted)reject(input.signal.reason);else if(code===0)resolve();else reject(new Error(`Codex 실행 실패 (${code}): ${errorTail.replaceAll(input.token,"[redacted]")}`));});
   child.stdin.on("error",()=>{});child.stdin.end(input.prompt);
   if(input.signal.aborted)abort();
  });
  return JSON.parse(await readFile(output,"utf8")) as Record<string,unknown>;
 }finally{await rm(directory,{recursive:true,force:true});}
}
