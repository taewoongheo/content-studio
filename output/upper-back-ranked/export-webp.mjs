import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const project=JSON.parse(await fs.readFile('output/upper-back-ranked/export-current.json','utf8')).structuredContent;
const dest='/Users/taewoongheo/Projects/liftcode-workspace/tiktok/exercises/등';
const names={11:'face-pull',10:'suspension-row',9:'dumbbell-bent-over-row',8:'seal-row',7:'barbell-bent-over-row',6:'wide-grip-cable-row',5:'chest-supported-dumbbell-row',4:'smith-machine-row',3:'chest-supported-machine-row',2:'chest-supported-t-bar-row',1:'kelso-shrug'};
const planned=[];
for(const slide of project.editor.document.slides){const rank=slide.placements.find(p=>p.elementId==='rank');if(!rank)continue;const n=Number(rank.value.replace('#',''));const name=names[n];assert(name);const art=slide.placements.find(p=>p.elementId==='art');assert(art?.value);let filename=`${name}.webp`;let version=2;while(await fs.access(path.join(dest,filename)).then(()=>true,()=>false))filename=`${name}-v${version++}.webp`;planned.push({rank:n,exercise:slide.name.replace(/^#\d+ /,''),assetId:art.value,filename,output:path.join(dest,filename)});}
assert.equal(planned.length,11);assert.equal(new Set(planned.map(x=>x.output)).size,11);
const conversions=[];
for(const item of planned){const response=await fetch(`http://127.0.0.1:3000/api/content-jobs/${project.id}/assets/${item.assetId}`);assert(response.ok,`Asset request failed: ${response.status}`);const original=Buffer.from(await response.arrayBuffer());const before=await sharp(original).metadata();const webp=await sharp(original).webp({lossless:true,effort:6}).toBuffer();const after=await sharp(webp).metadata();assert.equal(after.format,'webp');assert.equal(after.width,before.width);assert.equal(after.height,before.height);assert.equal(after.hasAlpha,before.hasAlpha);
const a=await sharp(original).ensureAlpha().raw().toBuffer();const b=await sharp(webp).ensureAlpha().raw().toBuffer();assert.equal(a.length,b.length);for(let i=0;i<a.length;i+=4){assert.equal(a[i+3],b[i+3]);if(a[i+3]){assert.equal(a[i],b[i]);assert.equal(a[i+1],b[i+1]);assert.equal(a[i+2],b[i+2]);}}
conversions.push({item,webp,width:after.width,height:after.height,originalBytes:original.length,bytes:webp.length});}
const manifest=[];for(const {item,webp,...metadata} of conversions){await fs.writeFile(item.output,webp,{flag:'wx'});const check=await sharp(item.output).metadata();assert.equal(check.format,'webp');manifest.push({...item,...metadata,alpha:check.hasAlpha,pixelsVerified:true});console.log(item.filename,`${check.width}x${check.height}`);}
await fs.writeFile('output/upper-back-ranked/webp-export-manifest.json',JSON.stringify({projectId:project.id,destination:dest,lossless:true,count:manifest.length,files:manifest},null,2));console.log(JSON.stringify({count:manifest.length,sourceBytes:manifest.reduce((s,x)=>s+x.originalBytes,0),webpBytes:manifest.reduce((s,x)=>s+x.bytes,0)}));
