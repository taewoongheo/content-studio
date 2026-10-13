import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'node:fs/promises';
import sharp from 'sharp';
const c=new Client({name:'content-qa',version:'1'});await c.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3000/mcp')));
const j=(await c.callTool({name:'read_project',arguments:{projectId:'bda1be0f-3788-445a-b283-70b0cce9f4c5'}})).structuredContent;
await fs.writeFile('output/upper-back-ranked/saved-project.json',JSON.stringify(j,null,2));
for(const [i,s] of j.editor.document.slides.entries()){
 const r=await c.callTool({name:'preview_slide',arguments:{projectId:j.id,slideId:s.id}});if(r.isError)throw new Error(JSON.stringify(r));
 const img=r.content.find(x=>x.type==='image');await fs.writeFile(`output/upper-back-ranked/previews/${String(i+1).padStart(2,'0')}.png`,Buffer.from(img.data,'base64'));console.log('Preview',i+1,s.name);
}
const comps=[];for(let i=0;i<j.slideCount;i++)comps.push({input:await sharp(`output/upper-back-ranked/previews/${String(i+1).padStart(2,'0')}.png`).resize(270,338).toBuffer(),left:(i%4)*270,top:Math.floor(i/4)*338});
await sharp({create:{width:1080,height:Math.ceil(j.slideCount/4)*338,channels:3,background:'#dddddd'}}).composite(comps).png().toFile('output/upper-back-ranked/contact-sheet.png');
console.log('Saved revision',j.savedRevision,'Current revision',j.editor.revision);await c.close();
