import fs from 'node:fs/promises';
import path from 'node:path';
const dir=path.resolve('output/upper-back-ranked');
const j=JSON.parse(await fs.readFile(`${dir}/clone-response.json`)).structuredContent;
const c=JSON.parse(await fs.readFile(`${dir}/content.json`));
const d=j.editor.document;
const commands=[{type:'remove_slide',slideId:'slide-4'},{type:'remove_slide',slideId:'slide-6'}];
const slides=d.slides.filter(s=>!['slide-4','slide-6'].includes(s.id));
const set=(s,p,value,textColors=[])=>commands.push({type:'set_slot_value',slideId:s,placementId:p,value,textColors});
const visual=(s,p,frame,style)=>commands.push({type:'update_visual',scope:'local',slideId:s,placementId:p,...(frame?{frame}:{}),...(style?{style}:{})});
set('slide-1','hook','UPPER BACK EXERCISES\nRANKED',[{start:21,end:27,color:'#e32400'}]);
visual('slide-1','hook',{x:.03,y:.13,width:.94,height:.22},{fontSize:104,lineHeight:1.04});
set('slide-1','cover-subtitle','11 exercises. Which one takes the top spot?');
visual('slide-1','cover-subtitle',{x:.07,y:.35,width:.86,height:.06},{fontSize:33});
commands.push({type:'rename_slide',slideId:'slide-1',name:c.title},{type:'set_local_image',slideId:'slide-1',placementId:'art',localPath:`${dir}/assets/cover.webp`});
visual('slide-1','art',{x:.05,y:.43,width:.9,height:.68});
for(let i=0;i<c.items.length;i++){
 const item=c.items[i],s=slides[i+1].id;
 commands.push({type:'rename_slide',slideId:s,name:`#${item.rank} ${item.name.replace('\n',' ')}`});
 set(s,'rank',`#${item.rank}`);set(s,'title',item.name);set(s,'body',item.body);
 visual(s,'title',item.name.includes('\n')?{x:.055,y:.192,width:.89,height:.118}:null,{fontSize:item.name.length>23?56:64,lineHeight:1.02});
 if(item.name.includes('\n'))visual(s,'body',{x:.05,y:.32,width:.9,height:.092},{fontSize:32,lineHeight:1.25});
 commands.push({type:'set_local_image',slideId:s,placementId:'art',localPath:`${dir}/assets/${item.asset}`});
 // Each illustration's natural ratio is preserved; frames keep equipment clear of text and badge.
 const f=[{x:.19,y:.42,width:.72,height:.49},{x:.06,y:.43,width:.88,height:.47},{x:.12,y:.42,width:.76,height:.48},{x:.045,y:.45,width:.91,height:.43},{x:.09,y:.42,width:.82,height:.49},{x:.06,y:.43,width:.88,height:.49},{x:.07,y:.44,width:.86,height:.46},{x:.16,y:.435,width:.68,height:.475},{x:.10,y:.45,width:.8,height:.46},{x:.11,y:.45,width:.78,height:.46},{x:.045,y:.44,width:.91,height:.46}][i];
 visual(s,'art',f,{imageFit:'contain'});
 commands.push({type:'set_slide_background',slideId:s,color:'#FFFFFF'});
}
commands.push({type:'set_slide_background',slideId:'slide-1',color:'#FFFFFF'});
await fs.writeFile(`${dir}/edit.json`,JSON.stringify({projectId:j.id,expectedRevision:j.editor.revision,expectedTabId:j.tabId,commands},null,2));
console.log({commands:commands.length,slides:slides.length});
