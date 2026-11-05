import { LOCAL_DATABASE_PATH } from "../../src/lib/local-db/database";
import { parseArgs } from "node:util";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import Database from "better-sqlite3";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHash } from "node:crypto";

const {values}=parseArgs({options:{draft:{type:"string"},step:{type:"string"},output:{type:"string"},source:{type:"string"},continue:{type:"boolean"},timeout:{type:"string",default:"1200"}}});
if (!values.draft || !["analysis","hook","visual"].includes(values.step??"") || !values.output)
  throw new Error("Usage: pnpm experiment:node --draft 28 --step visual --output /absolute/experiment [--continue] [--timeout 1200]");
const output=resolve(values.output), source=resolve(values.source??LOCAL_DATABASE_PATH);
const database=join(output,"experiment.sqlite"), timeout=Number(values.timeout)*1000;
if (!Number.isFinite(timeout)||timeout<1000||timeout>3600000) throw new Error("timeout must be 1–3600 seconds");
if (database===source) throw new Error("Experiment DB must differ from source DB");
await mkdir(output,{recursive:true});
const exists=await stat(database).then(()=>true,()=>false);
if (exists&&!values.continue) throw new Error("Output already contains an experiment. Use a new output folder or --continue.");
if (!exists&&values.continue) throw new Error("No experiment snapshot to continue");
if (!exists) {
  const db=new Database(source,{readonly:true,fileMustExist:true});
  try { await db.backup(database); } finally { db.close(); }
}
const db=new Database(database,{readonly:true});
const row=db.prepare("SELECT draft_id FROM content_draft_numbers WHERE number=?").get(values.draft) as {draft_id:string}|undefined;
db.close();
if(!row)throw new Error("Draft number not found in snapshot");
const id=row.draft_id, run=join(output,new Date().toISOString().replaceAll(":","-"));
await mkdir(run,{recursive:true});
const portServer=createServer();await new Promise<void>(r=>portServer.listen(0,"127.0.0.1",r));
const address=portServer.address();if(!address||typeof address==="string")throw new Error("No port");
const port=address.port;await new Promise<void>(r=>portServer.close(()=>r()));
const origin=`http://127.0.0.1:${port}`;
const dist=`.next-experiment-${process.pid}`, config=`.next-mcp-smoke-experiment-${process.pid}.tsconfig.json`;
await writeFile(config,await readFile("tsconfig.json"));
const child=spawn("pnpm",["dev","--port",String(port)],{env:{...process.env,CONTENT_STUDIO_DB_PATH:database,
  CONTENT_STUDIO_EXPERIMENT:"1",CONTENT_STUDIO_EXPERIMENT_OUTPUT:run,CONTENT_STUDIO_DISABLE_COLLECTION:"1",
  CONTENT_STUDIO_DIST_DIR:dist,CONTENT_STUDIO_TSCONFIG_PATH:config},stdio:["ignore","pipe","pipe"],detached:true});
let log="", client:Client|undefined;
child.stdout.on("data",chunk=>{log+=chunk;});child.stderr.on("data",chunk=>{log+=chunk;});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const get=async()=>{const response=await fetch(`${origin}/api/content-production?id=${id}`);const value=await response.json();if(!response.ok)throw new Error(JSON.stringify(value));return value;};
async function capture(label:string, detail:Awaited<ReturnType<typeof get>>) {
  await writeFile(join(run,`${label}.json`),JSON.stringify(detail,null,2));
  const projectId=detail.task.project_id;if(!projectId)return;
  const call=async(name:string,args:Record<string,unknown>)=>{const r=await client!.callTool({name,arguments:args},undefined,{timeout:180000});if(r.isError)throw new Error(JSON.stringify(r));return r;};
  await call("open_project",{projectId});
  const result=await call("read_project",{projectId});
  await writeFile(join(run,`${label}-project.json`),JSON.stringify(result.structuredContent,null,2));
  const previews=await call("preview_slides",{projectId,width:1080});let index=0;
  for(const c of previews.content as Array<{type:string;data?:string}>)if(c.type==="image")
    await writeFile(join(run,`${label}-${String(++index).padStart(2,"0")}.png`),Buffer.from(c.data!,"base64"));
  const layout=await call("inspect_slide_layout",{projectId});
  await writeFile(join(run,`${label}-layout.json`),JSON.stringify(layout.structuredContent,null,2));
}
let signalled=false;
async function stop() {
  signalled=true;
  try {await fetch(`${origin}/api/content-production`,{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify({action:"stop",id})});} catch {}
}
process.once("SIGINT",()=>void stop());process.once("SIGTERM",()=>void stop());
try {
  const start=Date.now();
  while(true){try{if((await fetch(`${origin}/mcp`)).status===405)break;}catch{}
    if(child.exitCode!==null||Date.now()-start>90000)throw new Error("Experiment server failed to start; see server.log");await sleep(500);}
  client=new Client({name:"node-experiment",version:"1.0.0"});
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
  await capture("before",await get());
  const response=await fetch(`${origin}/api/content-production`,{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify({action:"experiment",id,step:values.step})});
  if(!response.ok)throw new Error(await response.text());
  console.log(JSON.stringify({run,origin,draft:values.draft,step:values.step,state:"running"}));
  const deadline=Date.now()+timeout;let previous="";
  while(true){
    await sleep(3000);const detail=await get();
    const state=detail.task.state;
    if(state!==previous){console.log(JSON.stringify({state,step:detail.task.current_step}));previous=state;}
    if(["finished","failed","stopped"].includes(state)){
      await capture("after",detail);
      const input=await readFile(join(run,"input.json"),"utf8");
      const snapshot=JSON.parse(input);
      await writeFile(join(run,"manifest.json"),JSON.stringify({draft:values.draft,id,step:values.step,state,
        prompt_sha256:createHash("sha256").update(snapshot.prompt).digest("hex"),source_database:source,
        snapshot_database:database,continued:!!values.continue,run},null,2));
      console.log(JSON.stringify({state,artifacts:run}));
      if(state!=="finished")process.exitCode=1;break;
    }
    if(Date.now()>deadline||signalled){await stop();throw new Error("Experiment stopped at time limit or interruption; snapshot retained");}
  }
} finally {
  await client?.close();
  if(child.pid){try{process.kill(-child.pid,"SIGTERM");}catch{}}
  await Promise.race([new Promise<void>(r=>child.once("exit",()=>r())),sleep(3000)]);
  if(child.exitCode===null&&child.pid){try{process.kill(-child.pid,"SIGKILL");}catch{}}
  await writeFile(join(run,"server.log"),log);
  await rm(dist,{recursive:true,force:true});await rm(config,{force:true});
}
