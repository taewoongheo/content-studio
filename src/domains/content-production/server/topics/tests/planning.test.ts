import test from 'node:test';
import assert from 'node:assert/strict';
import { openLocalDatabase } from '@/lib/local-db/database';
import { ProductionStore } from '../../persistence/store';
import { prepareTopics } from '../service';
import { evaluateTopics } from '../evidence';
import { selectTopics } from '../selection';
import type { TopicCandidate, TopicMatch } from '../../../domain/topics/model';
import type { runCodex } from '@/lib/ai/codex';
const candidate = (id: string): TopicCandidate => ({ id, topic: id, reader_question: `Question ${id}`, content_type: 'Comparison', message: 'Choose for your situation', rationale: 'Observed useful question', reference_ids: ['reference'] });
const candidates = ['known', 'new-a', 'new-b', 'uncertain'].map(candidate);
const matches: TopicMatch[] = candidates.map(row => ({ candidate_id: row.id, direct_log_ids: row.id === 'known' ? ['a', 'b'] : row.id === 'uncertain' ? ['c'] : [], related_log_ids: [], reason: 'Semantic match' }));
const performance = [{ log_id: 'a', stage: 'middle', view_count: 1000, like_count: 60, comment_count: 0, save_count: 40 }, { log_id: 'b', stage: 'middle', view_count: 1000, like_count: 50, comment_count: 0, save_count: 40 }, { log_id: 'c', stage: 'middle', view_count: 1000, like_count: 10, comment_count: 0, save_count: 10 }];
test('repeat evidence is stage matched; missing, tiny and single viral results cannot establish support', () => {
  assert.deepEqual(evaluateTopics(candidates, matches, performance).map(row => row.status), ['proven', 'untried', 'untried', 'inconclusive']);
  for (const replacement of [{ ...performance[1], stage: 'early' }, { ...performance[1], view_count: 10 }, { ...performance[1], save_count: null }])
    assert.equal(evaluateTopics(candidates, matches, [performance[0], replacement, performance[2]])[0].status, 'inconclusive');
  const zero = performance.map(row => ({...row,like_count:0,comment_count:0,save_count:0}));
  assert.equal(evaluateTopics(candidates, matches, zero)[0].status, 'inconclusive', 'a zero baseline cannot establish positive evidence');
});
test('50:50 persists across odd batches, explores unseen topics, spreads candidates and reports exhausted lanes', () => {
  const evaluated = evaluateTopics(candidates, matches, performance);
  const first = selectTopics(evaluated, 3, [], () => 0);
  assert.deepEqual(first.map(row => row.requested_lane), ['proven', 'exploration', 'proven']);
  const previous = first.map(row => ({ candidate_id: row.candidate.id, requested_lane: row.requested_lane }));
  const second = selectTopics(evaluated, 3, previous, () => 0);
  assert.deepEqual(second.map(row => row.requested_lane), ['exploration', 'proven', 'exploration']);
  assert.equal(new Set(first.map(row => row.candidate.id)).size, 3, 'do not repeat a proven topic merely to fill the ratio');
  assert.equal([...first, ...second].filter(row => row.requested_lane === 'proven').length, 3);
  assert.ok(first[2].fallback, 'report a proven lane exhausted within the batch');
  const fallback = selectTopics(evaluated.filter(row => row.status === 'untried'), 2, [], () => 0);
  assert.ok(fallback[0].fallback);
  assert.equal(fallback[0].status, 'untried');
});
test('repeated batches balance the lanes and cover every eligible candidate without favoring one highest score', () => {
  const evaluated = evaluateTopics(candidates, matches, performance);
  const pool = Array.from({length: 8}, (_, index) => ({
    ...evaluated[index < 4 ? 0 : 1], candidate: candidate(`candidate-${index}`), score: 10 - index,
  }));
  const previous: {candidate_id:string; requested_lane:'proven'|'exploration'}[] = [];
  for (let batch = 0; batch < 20; batch++) {
    const selected = selectTopics(pool, 3, previous, () => 0);
    assert.equal(new Set(selected.map(row => row.candidate.id)).size, 3);
    assert.ok(selected.every(row => row.requested_lane === row.selected_lane && !row.fallback));
    previous.push(...selected.map(row => ({candidate_id:row.candidate.id,requested_lane:row.requested_lane})));
  }
  assert.equal(previous.filter(row => row.requested_lane === 'proven').length, 30);
  const counts = pool.map(row => previous.filter(choice => choice.candidate_id === row.candidate.id).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
});
test('pool and semantic links cache independently; metrics recompute without model calls and assignments survive resume', async () => {
  const db = openLocalDatabase(':memory:'), store = new ProductionStore(db);
  let calls = 0;
  try {
    db.prepare("INSERT INTO content_reference_accounts(username,url,created_at) VALUES('spy','https://example.com','now')").run();
    db.prepare("INSERT INTO content_external_references(id,url,account,caption,observed_at,images_json,created_at) VALUES('reference','https://example.com/1','spy','Comparisons and plans','now','[]','now')").run();
    for (const id of ['a', 'b', 'c']) {
      db.prepare("INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at) VALUES(?,?,'4:5',1,'English','{}','now','now')").run(id, id);
      db.prepare("INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,topic,message,content_type,created_at,updated_at) VALUES(?,?,?,'2026-10-01','known','Choose','Comparison','now','now')").run(id, id, `https://example.com/${id}`);
    }
    for (const row of performance)
      db.prepare('INSERT INTO content_performance(log_id,stage,view_count,like_count,comment_count,save_count) VALUES(?,?,?,?,?,?)').run(row.log_id, row.stage, row.view_count, row.like_count, row.comment_count, row.save_count);
    const executor: typeof runCodex = async (input) => {
      calls++;
      assert.equal(input.standalone, true);
      assert.deepEqual(input.capabilities, {webSearch:false,shell:false,imageGeneration:false});
      if (input.prompt.startsWith('# Build reusable'))
        return { candidates: candidates.map(({ id, ...row }) => { void id; return row; }) };
      const data = JSON.parse(input.prompt.split('Candidates:\n')[1].split('\nOwn posts:')[0]) as TopicCandidate[];
      return { matches: data.map(row => ({ ...matches.find(match => match.candidate_id === row.topic)!, candidate_id: row.id })) };
    };
    const first = await prepareTopics(db, 2, 'http://localhost', executor);
    assert.equal(calls, 2);
    const ids = store.create(2, [], undefined, first);
    assert.equal(store.get(ids[0]).input?.topic_assignment?.status, 'proven');
    assert.equal(store.analysisInputs(ids[0]).length, 2, 'direct matches supplement the sampled comparison set');
    store.state(ids[0], 'running');
    store.save(ids[0], 'analysis', { research: [] });
    assert.deepEqual(new ProductionStore(db).get(ids[0]).input, store.get(ids[0]).input);
    db.prepare("UPDATE content_performance SET like_count=0,save_count=0 WHERE log_id='a'").run();
    const next = await prepareTopics(db, 2, 'http://localhost', executor);
    assert.equal(calls, 2);
    assert.ok(next.assignments[0].fallback);
    db.prepare("UPDATE content_creation_logs SET topic='updated topic' WHERE id='a'").run();
    await prepareTopics(db, 2, 'http://localhost', executor);
    assert.equal(calls, 3, 'only matching reruns');
    db.prepare("UPDATE content_external_references SET caption='A new topic' WHERE id='reference'").run();
    await prepareTopics(db, 2, 'http://localhost', executor);
    assert.equal(calls, 4, 'pool reruns, unchanged output reuses matches');
    db.prepare("UPDATE content_external_references SET view_count=12345,observed_at='later' WHERE id='reference'").run();
    await prepareTopics(db, 2, 'http://localhost', executor);
    assert.equal(calls, 4, 'spy metric updates do not invalidate topic evidence');
    db.prepare("UPDATE content_reference_accounts SET enabled=0 WHERE username='spy'").run();
    await assert.rejects(prepareTopics(db, 2, 'http://localhost', executor), /spy 자료가 없습니다/);
    assert.equal(calls, 4, 'disabled accounts cannot reuse a previously valid pool');
    assert.deepEqual(await prepareTopics(db, 0, 'http://localhost', executor), {assignments:[],history:[]});
    assert.deepEqual(db.pragma('foreign_key_check'), []);
  }
  finally {
    db.close();
  }
});
