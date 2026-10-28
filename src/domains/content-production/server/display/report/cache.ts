import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import { defaultDatabasePath } from "@/lib/local-db/database";
import { stageReportSchema, type StageReport } from "../../../domain/report/model";
function cachePath() {
  const root=process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR??join(dirname(defaultDatabasePath()),".content-studio-production");
  if(!isAbsolute(root))throw new Error("보고서 캐시 경로는 절대 경로여야 합니다.");
  return join(root,"stage-reports.json");
}
export function loadReportCache(): Map<string,StageReport> {
  try {
    const data=JSON.parse(readFileSync(cachePath(),"utf8"));
    if(data.version!==1||!Array.isArray(data.entries))return new Map();
    return new Map(data.entries.slice(-80).flatMap((entry:unknown)=>{
      if(!Array.isArray(entry)||typeof entry[0]!=="string"||!/^[a-f0-9]{64}$/.test(entry[0]))return [];
      const parsed=stageReportSchema.safeParse(entry[1]);return parsed.success?[[entry[0],parsed.data]]:[];
    }));
  } catch {return new Map();}
}
export function saveReportCache(cache:Map<string,StageReport>) {
  const path=cachePath(),temporary=`${path}.${randomUUID()}.tmp`;
  try {mkdirSync(dirname(path),{recursive:true});writeFileSync(temporary,JSON.stringify({version:1,entries:[...cache]}),{mode:0o600});renameSync(temporary,path);}
  catch {/* Display cache is expendable and never blocks production. */}
  finally {try{rmSync(temporary,{force:true});}catch{}}
}
