import type Database from "better-sqlite3";

export function draftNumber(db: Database.Database, id: string): number {
  const row=db.prepare("SELECT number FROM content_draft_numbers WHERE draft_id=?").get(id) as {number:number}|undefined;
  if(!row) throw new Error("작업을 찾을 수 없습니다. /job으로 목록을 확인해 주세요.");
  return row.number;
}
export function draftId(db: Database.Database, raw: string): string {
  if(!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
    throw new Error("작업 번호를 입력해 주세요. 예: /stop 1");
  const row=db.prepare("SELECT draft_id FROM content_draft_numbers WHERE number=?").get(Number(raw)) as {draft_id:string}|undefined;
  if(!row) throw new Error("작업을 찾을 수 없습니다. /job으로 목록을 확인해 주세요.");
  return row.draft_id;
}
