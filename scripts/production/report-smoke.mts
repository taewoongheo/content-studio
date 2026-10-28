import assert from "node:assert/strict";
import type { Browser } from "playwright";
const steps=[['analysis','분석 및 제작 방향'],['production','초안 제작'],['hook','훅 검토·수정'],['polish','영어 폴리싱'],['visual','시각 검증·수정']] as const;
export async function verifyStageReports(browser:Browser,origin:string) {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const internal='12345678-1234-1234-1234-123456789012';
 const task={id:'report-fixture',log_id:internal,current_step:'visual',state:'failed',project_id:null,created_at:'2026-10-28T00:00:00Z',updated_at:'2026-10-28T00:00:00Z',topic:'Chest exercise comparison',content_type:'Exercise ranking'};
 const raw={analysis:`RAW CONTENT ${internal}`,research:[{question:'RAW QUESTION',source:'https://example.com/private',finding:'RAW FINDING',judgment:'RAW JUDGMENT'}],sources:[{kind:'log',id:internal,part:'RAW SOURCE',used_for:'RAW USE'}],completed_actions:['RAW ACTION'],updated_at:'2026-10-28T00:00:00Z'};
 const detail={task,log:{},analysis_inputs:[],external:{},...Object.fromEntries(steps.map(([step])=>[step,{...raw,state:step==='visual'?'failed':'completed'}]))};
 const requests=new Map<string,number>();let allowVisual=false;
 await page.route('**/api/content-production*',async route=>{
  const request=route.request();if(request.headers().accept?.includes('text/event-stream'))return route.continue();
  const url=new URL(request.url());
  if(request.method()==='GET') {
   if(url.searchParams.get('id')==='report-fixture')return route.fulfill({json:detail});
   const response=await route.fetch(),snapshot=await response.json();return route.fulfill({json:{...snapshot,tasks:[task],planningLogs:[],configured:{apify:true}}});
  }
  const input=request.postDataJSON();
  if(input.action==='translate_display')throw Error('raw translation must not be requested by the report UI');
  if(input.action!=='stage_report')return route.continue();
  requests.set(input.step,(requests.get(input.step)??0)+1);
  if(input.step==='visual'&&!allowVisual){return route.fulfill({status:500,json:{error:'INTERNAL_DEBUG_INFORMATION'}});}
  await new Promise(resolve=>setTimeout(resolve,100));
  return route.fulfill({json:{sourceKey:input.sourceKey,report:{headline:`정리된 ${input.step} 결과`,summary:'운동을 비교하는 형식을 유지하고 독자가 선택에 사용할 내용을 정리했습니다.',sections:[{title:'사례에서 얻은 판단',paragraphs:['가슴 운동 선택 사례에서 관찰한 반응을 이번 표현 방향에 연결했습니다.'],items:[{title:'비교 표현 유지',body:'한 장에 운동 하나를 보여 주고 차이를 설명합니다.',quote:''}]}],next_actions:input.step==='visual'?['남은 가독성 문제를 확인합니다.']:[]}}});
 });
 try {
  await page.goto(origin);await page.getByRole('button',{name:'제작 캔버스',exact:true}).click();
  const sidebar=page.locator('aside[aria-label="제작 사이드바"]');
  for(const [step,label] of steps) {
   await sidebar.getByRole('button',{name:new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click({timeout:8000});
   const panel=page.getByRole('region',{name:'단계 상세',exact:true});
   if(step==='visual') {
    await panel.getByRole('button',{name:'다시 정리',exact:true}).waitFor();
    allowVisual=true;await panel.getByRole('button',{name:'다시 정리',exact:true}).click();
   }
   await panel.getByRole('heading',{name:`정리된 ${step} 결과`,exact:true}).waitFor();
   const text=await panel.innerText();
   assert.ok(text.includes('사례에서 얻은 판단'));assert.ok(!text.includes(internal));assert.ok(!text.includes('RAW'));assert.ok(!text.includes('도구 호출'));assert.ok(!text.includes('https://'));assert.ok(!text.includes('INTERNAL_DEBUG_INFORMATION'));
   assert.equal(await panel.getByRole('button',{name:'영어 원문',exact:true}).count(),0);
   if(process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR&&step==='analysis')await page.screenshot({path:`${process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR}/stage-report.png`});
   await panel.getByRole('button',{name:'닫기',exact:true}).click();
  }
  const before=requests.get('analysis');await sidebar.getByRole('button',{name:/분석 및 제작 방향/}).click();
  await page.getByRole('heading',{name:'정리된 analysis 결과',exact:true}).waitFor();assert.equal(requests.get('analysis'),before,'reopening uses the prepared report');
  assert.deepEqual(errors,[]);console.log('PASS readable reports across all stages, hidden source/identifier/debug noise, retry and cached reopen');
 }catch(error){console.log('REPORT UI',await page.locator('body').innerText());if(process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR}/report-failed.png`});throw error;}finally{await page.close();}
}
