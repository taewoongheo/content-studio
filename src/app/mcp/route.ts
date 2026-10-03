import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isLocalRequest } from "@/lib/http/local-request";
import { createStudioMcpServer } from "@/lib/mcp/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isLocalRequest(request))
    return new Response("Local MCP requests only", { status: 403 });
  // Next may normalize request.url to localhost; use the validated Host for browser URLs.
  const url = new URL(`${new URL(request.url).protocol}//${request.headers.get("host")}`);
  const server = createStudioMcpServer(url.origin);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally { await server.close(); }
}
// This server uses request/response tools, without a persistent notification stream or protocol sessions.
export function GET() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
export function DELETE() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
