import assert from "node:assert/strict";
import sharp from "sharp";
import type { Browser } from "playwright";
import type { PublishedPost } from "../../src/domains/content-production/domain/published-posts";
import type { ProductionRequest } from "../../src/domains/content-production/domain/start/input";

/** Exercise the real UI with intercepted starts; never invoke paid production during a smoke run. */
export async function verifyProductionStart(browser: Browser, origin: string, post: PublishedPost) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const browserErrors: string[] = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  const sourceDocument = await page.request.get(`${origin}/api/content-projects/${post.id}/preview`).then(response => response.json());
  const previewStyle = {color:"#111111",backgroundColor:"transparent",fontSize:64,lineHeight:1.2,fontWeight:700,textAlign:"center",borderRadius:0,fontFamily:"inter",imageFit:"contain"};
  sourceDocument.elements.push({id:"source-cover",name:"Cover",kind:"image",role:"Cover artwork",frame:{x:0.1,y:0.2,width:0.8,height:0.6},style:previewStyle});
  sourceDocument.slides[0].backgroundColor="#E8F1FB";
  sourceDocument.slides[0].placements.push({id:"source-cover-1",elementId:"source-cover",value:"source-picker-cover",frameOverride:null,styleOverride:null});
  sourceDocument.slides[1].placements.push({id:"source-cover-2",elementId:"source-cover",value:"source-picker-body",frameOverride:null,styleOverride:null});
  const artwork = await sharp({create:{width:200,height:250,channels:3,background:"#00AA77"}}).png().toBuffer();
  const assetReads:string[]=[];
  await page.route("**/api/content-projects/*/assets/source-picker-*",route=>{
    assetReads.push(route.request().url());return route.fulfill({contentType:"image/png",body:artwork});
  });
  const fixtureDocument = structuredClone(sourceDocument);
  const imageElements = new Set(fixtureDocument.elements.filter((element: {id:string;kind:string}) => element.kind === "image").map((element: {id:string}) => element.id));
  fixtureDocument.slides.forEach((slide: {placements:Array<{elementId:string;value:string}>}) => slide.placements.forEach(placement => {if(imageElements.has(placement.elementId))placement.value="";}));
  const posts = [post,...Array.from({length:25},(_,index)=>({...post,id:`source-picker-${index}`,name:`페이지 확인 ${index}`,topic:`주제 ${index}`}))];
  const documentReads = new Map<string,number>();
  let selecting = false;
  await page.route("**/api/content-projects/*/preview",async route=>{
    const id = new URL(route.request().url()).pathname.split("/")[3];
    if (selecting) documentReads.set(id,(documentReads.get(id)??0)+1);
    return route.fulfill({json:id.startsWith("source-picker-")?fixtureDocument:sourceDocument});
  });
  let submitted: ProductionRequest[] | undefined, attempts = 0;
  await page.route("**/api/content-production", async route => {
    const request = route.request();
    if (request.headers().accept?.includes("text/event-stream")) return route.continue();
    if (request.method() === "GET") {
      const response = await route.fetch();
      const snapshot = await response.json();
      return route.fulfill({ json: { ...snapshot, publishedPosts: posts, configured: { apify: true } } });
    }
    const input = request.postDataJSON();
    if (input.action !== "start") return route.continue();
    submitted = input.requests;
    attempts++;
    return route.fulfill(attempts === 1 ? { status: 400, json: { error: "Fixture start failed" } } : { json: { ids: [] } });
  });
  try {
    await page.goto(origin);
    await page.getByRole("button", { name: "제작 캔버스", exact: true }).click();
    const add = page.getByRole("button", { name: "제작 요청 추가", exact: true });
    await add.click();
    await page.getByRole("dialog").getByRole("button", { name: "추가", exact: true }).click();
    await page.getByRole("button", { name: "1번 요청 수정", exact: true }).click();
    await page.getByLabel("추가 지침", { exact: false }).fill("덤벨만 사용");
    await page.getByRole("dialog").getByRole("button", { name: "수정", exact: true }).click();
    await add.click();
    selecting = true;
    await page.getByRole("radio", { name: "과거 게시글", exact: true }).check();
    const list = page.getByRole("radiogroup",{name:"원본 게시글",exact:true});
    const initialCount = await list.getByRole("radio").count();
    assert.ok(initialCount>=8&&initialCount<posts.length,"mount only a page of text entries");
    await list.evaluate(element=>{element.scrollTop=element.scrollHeight;});
    await page.waitForFunction(count=>document.querySelector('[role="radiogroup"]')!.querySelectorAll('input[type="radio"]').length>count,initialCount);
    await page.getByLabel("과거 게시글 검색",{exact:true}).fill("페이지 확인 24");
    await page.getByRole("radio",{name:"페이지 확인 24",exact:true}).waitFor();
    assert.equal(await list.getByRole("radio").count(),1,"search includes posts beyond the mounted page");
    await page.getByLabel("과거 게시글 검색",{exact:true}).fill("");
    await list.evaluate(element=>{element.scrollTop=0;});
    assert.equal(await list.locator("canvas,img").count(),0,"source list has no images");
    assert.equal(documentReads.size,0,"scrolling and searching the list never load slideshow documents");
    assert.equal(assetReads.length,0,"images are loaded only after selecting a source");
    await page.getByRole("dialog").getByText(post.name, { exact: true }).click();
    assert.equal(await page.getByRole("dialog").getByRole("radio", { name: post.name, exact: true }).isChecked(),true);
    await page.getByRole("region", { name: `${post.name} 슬라이드 미리보기`, exact: true }).waitFor();
    await page.getByRole("img", { name: "1번 슬라이드", exact: true }).waitFor();
    assert.equal(documentReads.get(post.id),1,"selected source document is loaded once");
    for (const viewport of [{width:1440,height:1000},{width:390,height:844},{width:1024,height:600},{width:844,height:390}]) {
      await page.setViewportSize(viewport);
      try {
        await page.waitForFunction(()=>{
          const dialog=document.querySelector<HTMLElement>('[role="dialog"]')!;
          const rect=dialog.getBoundingClientRect();
          const list=dialog.querySelector<HTMLElement>('[role="radiogroup"]');
          return dialog.scrollHeight<=dialog.clientHeight+1&&rect.y>=0&&rect.bottom<=window.innerHeight&&!!list&&list.clientHeight>=28;
        },undefined,{timeout:5000});
      } finally {
        if(process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR}/dialog-${viewport.width}-${viewport.height}.png`,animations:"disabled"});
      }
      const dialog=await page.getByRole("dialog").boundingBox();
      const submit=await page.getByRole("dialog").getByRole("button",{name:"추가",exact:true}).boundingBox();
      const bounds=await list.boundingBox();
      assert.ok(dialog&&submit&&bounds&&bounds.height>=28&&submit.y+submit.height<=dialog.y+dialog.height,"dialog fits without vertical scrolling and keeps list/footer accessible");
    }
    await page.setViewportSize({width:1440,height:1000});
    if (process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR}/source-picker.png`});
    await page.getByRole("dialog").getByRole("button", { name: "추가", exact: true }).click();
    await add.click();
    await page.getByRole("radio", { name: "외부 URL", exact: true }).check();
    await page.getByLabel("TikTok 슬라이드쇼 URL", { exact: true }).fill("https://example.com/post");
    await page.getByRole("dialog").getByRole("button", { name: "추가", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "TikTok 게시물의 전체 URL" }).waitFor();
    await page.getByLabel("TikTok 슬라이드쇼 URL", { exact: true }).fill("https://www.tiktok.com/@example/photo/123?tracking=1");
    await page.getByLabel("추가 지침", { exact: false }).fill("초보자 대상");
    if (process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR}/start-dialog.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    const box = await page.getByRole("dialog").boundingBox();
    assert.ok(box && box.x >= 0 && box.width <= 390 && box.height <= 844, "input modal fits a narrow viewport");
    await page.getByRole("dialog").getByRole("button", { name: "추가", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "1번 요청 삭제", exact: true }).click();
    assert.equal(await page.getByRole("list", { name: "제작 요청 목록" }).getByRole("listitem").count(), 2);
    await add.click();
    await page.getByRole("dialog").getByRole("button", { name: "추가", exact: true }).click();
    if (process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR}/start-requests.png` });
    const start = page.getByRole("button", { name: "3개 제작 시작", exact: true });
    await start.click();
    await page.getByRole("alert").filter({ hasText: "Fixture start failed" }).waitFor();
    assert.equal(await page.getByRole("list", { name: "제작 요청 목록" }).getByRole("listitem").count(), 3, "failed start preserves requests");
    await start.click();
    await page.getByRole("list", { name: "제작 요청 목록" }).waitFor({ state: "detached" });
    assert.deepEqual(submitted, [
      { mode: "past_post", sourceProjectId: post.id, instructions: "" },
      { mode: "external_url", url: "https://www.tiktok.com/@example/photo/123", instructions: "초보자 대상" },
      { mode: "automatic", instructions: "" },
    ]);
    assert.deepEqual(browserErrors, []);
    console.log("PASS text-only infinite source list, selection-only images, fixed dialog at four viewport sizes, full-list search, start modal modes, saved preview, optional instructions, edit/delete, narrow viewport and failed-start recovery");
  } finally { await page.close(); }
}
