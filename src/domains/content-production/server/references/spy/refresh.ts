import { saveSpyPosts } from "./storage";
import type Database from "better-sqlite3";
import { ApifySpyClient } from "@/domains/research/server/apify/spy-posts";
import { publishChange } from "../../events";
export type SpyAccountStatus = { state: "running"|"completed"|"failed"; count: number; error?: string };
export type SpyStatus = { running: boolean; accounts: Record<string,SpyAccountStatus> };
const shared = globalThis as typeof globalThis & { spyRefreshes?: Map<string,{promise?:Promise<SpyStatus>;status:SpyStatus;scope:string[]}> };
const refreshes = (shared.spyRefreshes ??= new Map<string,{promise?:Promise<SpyStatus>;status:SpyStatus;scope:string[]}>());
export function spyStatus(db: Database.Database): SpyStatus { return refreshes.get(db.name)?.status ?? {running:false,accounts:{}}; }

export function refreshSpy(db: Database.Database, client: Pick<ApifySpyClient,"posts"> = new ApifySpyClient(), onlyAccounts?: string[]): Promise<SpyStatus> {
  const accounts = (db.prepare("SELECT username,last_fetched_at FROM content_reference_accounts ORDER BY username").all() as {username:string;last_fetched_at:string|null}[])
    .filter(account => !onlyAccounts || onlyAccounts.includes(account.username));
  const existing = refreshes.get(db.name);
  if (existing?.promise) {
    const missing = accounts.map(account=>account.username).filter(name=>!existing.scope.includes(name));
    if (!missing.length) return existing.promise;
    return existing.promise.then(async first => {
      const next = await refreshSpy(db,client,missing);
      return {running:false,accounts:{...first.accounts,...next.accounts}};
    });
  }
  const entry: {promise?:Promise<SpyStatus>;status:SpyStatus;scope:string[]} = {
    status:{running:true,accounts:{...existing?.status.accounts}},scope:accounts.map(account=>account.username),
  };
  refreshes.set(db.name,entry);
  entry.promise = run().finally(() => { entry.status.running=false;entry.promise=undefined;publishChange({kind:"library"}); });
  return entry.promise;
  async function run() {
    for (const account of accounts) entry.status.accounts[account.username]={state:"running",count:0};
    publishChange({kind:"library"});
    const known = new Map(accounts.map(account => [account.username,new Set((db.prepare("SELECT id FROM content_external_references WHERE account=?").all(account.username) as {id:string}[]).map(post=>post.id))]));
    const initial = accounts.filter(account=>!account.last_fetched_at).map(account=>account.username);
    await batch(initial,100,true);
    let pending = accounts.filter(account=>!!account.last_fetched_at).map(account=>account.username);
    for (const limit of [1,3,10,30,100]) {
      if (!pending.length) break;
      pending = await batch(pending,limit,false);
    }
    for (const account of pending) entry.status.accounts[account]={state:"failed",count:0,error:"100개 안에서 저장된 게시글에 도달하지 못했습니다. 누락 방지를 위해 갱신을 완료하지 않았습니다."};
    return entry.status;
    async function batch(names: string[], limit: number, initial: boolean) {
      if (!names.length) return [];
      try {
        const result = await client.posts(names,limit);
        const remaining: string[]=[];
        for (const account of names) {
          if (!db.prepare("SELECT 1 FROM content_reference_accounts WHERE username=?").get(account)) continue;
          const posts=result.get(account);
          // An empty/missing profile cannot establish a successful crawl or advance its checkpoint.
          if (!posts?.length) { entry.status.accounts[account]={state:"failed",count:0,error:"게시글이 반환되지 않았습니다. 기존 자료를 유지합니다."};continue; }
          const reached = posts.some(post=>known.get(account)!.has(post.id));
          if (!initial && !reached && posts.length>=limit) { remaining.push(account);continue; }
          const count = posts.filter(post=>!known.get(account)!.has(post.id)).length;
          saveSpyPosts(db,account,posts);
          entry.status.accounts[account]={state:"completed",count};
        }
        publishChange({kind:"library"});
        return remaining;
      } catch (error) {
        for (const account of names) entry.status.accounts[account]={state:"failed",count:0,error:error instanceof Error?error.message:"갱신 실패"};
        publishChange({kind:"library"});
        return [];
      }
    }
  }
}
