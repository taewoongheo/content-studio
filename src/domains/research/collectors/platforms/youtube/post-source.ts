/** Extract only the requested post, never a recommended post's channel. */
export function postChannel(html:string,postId:string):string {
  const marker=/(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*/.exec(html);
  if(!marker) throw new Error("YouTube 게시글 데이터를 찾을 수 없습니다.");
  const start=marker.index+marker[0].length;
  let depth=0,quoted=false,escaped=false,end=start;
  for(;end<html.length;end++) {
    const char=html[end];
    if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
    if(char==='"')quoted=true;
    else if(char==='{')depth++;
    else if(char==='}' && --depth===0){end++;break;}
  }
  const data:unknown=JSON.parse(html.slice(start,end));
  function find(value:unknown):string|undefined {
    if(!value || typeof value!=="object")return;
    const record=value as Record<string,unknown>;
    const post=(record.backstagePostRenderer ?? record.postRenderer) as {postId?:string;authorEndpoint?:{browseEndpoint?:{browseId?:string}}}|undefined;
    if(post?.postId===postId){const id=post.authorEndpoint?.browseEndpoint?.browseId;if(id && /^UC[\w-]+$/.test(id))return id;}
    for(const child of Object.values(record)){const id=find(child);if(id)return id;}
  }
  const channel=find(data);
  if(!channel)throw new Error("YouTube 게시글의 원본 채널을 찾을 수 없습니다.");
  return channel;
}
export async function discoverPostChannel(postId:string,signal:AbortSignal,transport:typeof fetch=fetch) {
  const response=await transport(`https://www.youtube.com/post/${encodeURIComponent(postId)}`,{
    redirect:"error",signal:AbortSignal.any([signal,AbortSignal.timeout(20_000)]),
    headers:{"User-Agent":"Mozilla/5.0","Accept-Language":"en-US,en;q=0.9"},
  });
  if(!response.ok || !response.body)throw new Error("YouTube 게시글을 불러오지 못했습니다.");
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
  try {while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.length;if(bytes>4*1024*1024)throw new Error("YouTube 게시글 응답이 너무 큽니다.");chunks.push(chunk.value);}}
  finally {await reader.cancel();}
  signal.throwIfAborted();
  return postChannel(Buffer.concat(chunks).toString("utf8"),postId);
}
export function originalYouTubeImage(raw:string) {
  const url=new URL(raw,"https://www.youtube.com");
  if(url.protocol!=="https:" || !["ggpht.com","googleusercontent.com"].some(host=>url.hostname===host || url.hostname.endsWith(`.${host}`)))
    throw new Error("YouTube 이미지 주소를 확인할 수 없습니다.");
  url.pathname=url.pathname.split("=")[0]+"=s1600";
  return url.href;
}
