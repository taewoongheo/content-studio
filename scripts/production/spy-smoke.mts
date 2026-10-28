import assert from "node:assert/strict";
import type { Browser } from "playwright";
export async function verifySpy(browser:Browser,origin:string) {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 let refreshes=0;
 await page.route('**/api/content-production',async route=>{
  const request=route.request();if(request.headers().accept?.includes('text/event-stream'))return route.continue();
  if(request.method()==='GET') {
   const response=await route.fetch(),snapshot=await response.json();
   return route.fulfill({json:{...snapshot,referenceAccounts:[{username:'example',url:'https://www.tiktok.com/@example',last_fetched_at:'2026-10-28T00:00:00Z'}],externalReferences:[{id:'1',url:'https://www.tiktok.com/@example/photo/1',account:'example',caption:'A practical back workout',published_at:'2026-10-28T00:00:00Z',observed_at:'2026-10-28T00:00:00Z',view_count:1000,like_count:30,engagement_rate:0.05,slide_count:5}],spy:{running:false,accounts:{}}}});
  }
  if(request.postDataJSON().action==='refresh_spy'){refreshes++;return route.fulfill({json:{running:false,accounts:{}}});}
  return route.continue();
 });
 try {
  await page.goto(origin);
  await page.getByRole('tab',{name:'외부 레퍼런스 스파이',exact:true}).click();
  await page.getByRole('heading',{name:'외부 레퍼런스 스파이',exact:true}).waitFor();
  await page.getByText('A practical back workout',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'전체 갱신',exact:true}).click();
  assert.equal(refreshes,1);
  if(process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR}/spy-dashboard.png`});
  await page.getByRole('button',{name:'제작 캔버스',exact:true}).click();
  await page.getByLabel('내부 게시글 성과 후보 수',{exact:true}).fill('20');
  await page.getByLabel('외부 레퍼런스 성과 후보 수',{exact:true}).fill('30');
  await page.getByRole('button',{name:'후보 수 저장',exact:true}).click();
  await page.getByRole('button',{name:'후보 수 저장',exact:true}).waitFor({state:'detached'});
  await page.reload();
  await page.getByRole('button',{name:'제작 캔버스',exact:true}).click();
  assert.equal(await page.getByLabel('내부 게시글 성과 후보 수',{exact:true}).inputValue(),'20');
  assert.equal(await page.getByLabel('외부 레퍼런스 성과 후보 수',{exact:true}).inputValue(),'30');
  if(process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR}/sampling-canvas.png`});
  assert.deepEqual(errors,[]);
  console.log('PASS spy dashboard, batch refresh action and persisted canvas sampling settings');
 }finally{await page.close();}
}
