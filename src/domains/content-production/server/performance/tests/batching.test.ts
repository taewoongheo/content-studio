import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLocalDatabase } from '@/lib/local-db/database';
import { parseApifyItem } from '@/domains/research/server/apify/client';
import { collectPerformance, PERFORMANCE_BATCH_SIZE } from '../collection';

const now=Date.parse('2026-11-01T00:00:00Z'), hour=3600000;
function seed(db:ReturnType<typeof openLocalDatabase>, count:number) {
  const insert=db.prepare("INSERT INTO content_creation_logs(id,post_url,actual_published_at,created_at,updated_at) VALUES(?,?,'2026-10-01','now','now')");
  for(let i=0;i<count;i++)insert.run(String(i),`https://www.tiktok.com/@a/photo/${i}`);
}
test('partial batches save successes and retry only failed posts with persistent 1h/6h/24h backoff',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'performance-batch-')), path=join(directory,'test.sqlite');
  let db=openLocalDatabase(path);
  const calls:string[][]=[];
  try {
    seed(db,PERFORMANCE_BATCH_SIZE+2);
    await collectPerformance(db,{posts:async urls=>{
      calls.push(urls);
      return urls.filter(url=>!url.endsWith('/0')).toReversed().map(url=>parseApifyItem({id:url.split('/').at(-1),playCount:42}));
    }},now);
    assert.deepEqual(calls.map(rows=>rows.length),[20,2]);
    assert.equal(db.prepare('SELECT count(*) FROM content_performance').pluck().get(),21);
    db.close(); db=openLocalDatabase(path);
    const missing={posts:async(urls:string[])=>{calls.push(urls);return [];}};
    await collectPerformance(db,missing,now+hour-1);
    assert.equal(calls.length,2);
    await collectPerformance(db,missing,now+hour);
    assert.deepEqual(calls[2],['https://www.tiktok.com/@a/photo/0']);
    await collectPerformance(db,missing,now+7*hour-1);
    assert.equal(calls.length,3);
    await collectPerformance(db,missing,now+7*hour);
    assert.equal(calls.length,4);
    await collectPerformance(db,missing,now+31*hour-1);
    assert.equal(calls.length,4);
    await collectPerformance(db,{posts:async urls=>{
      assert.deepEqual(urls,['https://www.tiktok.com/@a/photo/0']);
      return [parseApifyItem({id:'0',playCount:77})];
    }},now+31*hour);
    assert.equal(db.prepare('SELECT count(*) FROM content_performance').pluck().get(),22);
    assert.equal(db.prepare('SELECT count(*) FROM content_performance_retries').pluck().get(),0);
    await collectPerformance(db,{posts:async()=>{throw Error('Completed stages must not be fetched again');}},now+48*hour);
    assert.equal(db.prepare('SELECT count(*) FROM content_performance_retries').pluck().get(),0);
  } finally {db.close();rmSync(directory,{recursive:true,force:true});}
});
test('concurrent checks share a batch, reserve retry state before calling and do not resurrect deleted logs',async()=>{
  const db=openLocalDatabase(':memory:');
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  try {
    seed(db,2);
    let calls=0;
    const client={posts:async()=>{calls++;await gate;return [parseApifyItem({id:'0'}),parseApifyItem({id:'1'})];}};
    const first=collectPerformance(db,client,now), second=collectPerformance(db,client,now);
    assert.equal(first,second);
    assert.equal(db.prepare('SELECT count(*) FROM content_performance_retries').pluck().get(),2);
    db.prepare("DELETE FROM content_creation_logs WHERE id='0'").run();
    release();await first;
    assert.equal(calls,1);
    assert.deepEqual(db.prepare('SELECT log_id FROM content_performance').all(),[{log_id:'1'}]);
    assert.deepEqual(db.pragma('foreign_key_check'),[]);
  } finally {release();db.close();}
});
