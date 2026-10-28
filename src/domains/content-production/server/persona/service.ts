import { getLocalDatabase } from "@/lib/local-db/database";
import { accountIdentity } from "../references/library";
import { analyzePersona } from "./analysis";
import { editPersona, readPersona, replacePersona } from "./store";
import type { PersonaJob, PersonaSettings } from "../../domain/persona/model";

const shared = globalThis as typeof globalThis & { personaJob?: PersonaJob };
const idle: PersonaJob = { state: "idle", message: "", error: null };
export function personaState() {
  return { persona: readPersona(getLocalDatabase()), job: shared.personaJob ?? idle };
}
export function savePersona(revision: number, settings: PersonaSettings) {
  if (shared.personaJob?.state === "running") throw new Error("분석 중에는 수정할 수 없습니다.");
  return editPersona(getLocalDatabase(), revision, settings);
}
export function startPersonaAnalysis(raw: string) {
  if (shared.personaJob?.state === "running") throw new Error("페르소나를 분석하고 있습니다.");
  const { username } = accountIdentity(raw.trim());
  if (!process.env.APIFY_API_TOKEN?.trim()) throw new Error("서버의 APIFY_API_TOKEN을 설정해 주세요.");
  const db = getLocalDatabase();
  const job: PersonaJob = { state: "running", message: "분석 시작 중", error: null };
  shared.personaJob = job;
  void analyzePersona(username, message => { job.message = message; }).then(persona => {
    replacePersona(db, persona);
    job.state = "completed";
    job.message = "분석 완료";
  }).catch(error => {
    job.state = "failed";
    job.error = error instanceof Error ? error.message : "페르소나 분석에 실패했습니다.";
    job.message = "분석 실패";
  });
}
