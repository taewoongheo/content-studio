import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'node:fs/promises';
const c=new Client({name:'content-production',version:'1'}); await c.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3000/mcp')));
const args=process.argv[3]?JSON.parse(await fs.readFile(process.argv[3],'utf8')):{};
const r=await c.callTool({name:process.argv[2],arguments:args});
if(process.argv[4])await fs.writeFile(process.argv[4],JSON.stringify(r,null,2));
console.log(JSON.stringify(r));await c.close();
