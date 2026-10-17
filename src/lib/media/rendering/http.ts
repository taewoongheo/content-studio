import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

/** A render-scoped, loopback-only source with unguessable URLs; no media files are written. */
export async function serveRenderMedia(assets: Map<string, { type: string; bytes: Buffer }>) {
  const token = randomUUID();
  const server = createServer((request, response) => {
    const id = request.url?.startsWith(`/${token}/`) ? request.url.slice(token.length + 2) : "";
    const asset = assets.get(id);
    if (!asset) { response.writeHead(404); response.end(); return; }
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? "");
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(asset.bytes.length - 1, Number(range[2])) : asset.bytes.length - 1;
    if (start > end || start >= asset.bytes.length) { response.writeHead(416); response.end(); return; }
    response.writeHead(range ? 206 : 200, { "Content-Type": asset.type, "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*", "Content-Length": end - start + 1,
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${asset.bytes.length}` } : {}) });
    response.end(asset.bytes.subarray(start, end + 1));
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("렌더링 미디어 서버 오류");
  return {
    sources: Object.fromEntries([...assets.keys()].map(id => [id, `http://127.0.0.1:${address.port}/${token}/${id}`])),
    close: () => { server.closeAllConnections(); return new Promise<void>(resolve => server.close(() => resolve())); },
  };
}
