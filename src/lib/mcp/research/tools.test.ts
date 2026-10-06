import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CollectionRegistry } from "@/lib/research/collection/registry";
import { registerResearchTools } from "./tools";

test("MCP rejects off-platform URLs, shares job state across protocol instances and exposes no comment tool", async () => {
  let calls = 0;
  const registry = new CollectionRegistry(async () => { calls++; return { posts: [], nextCursor: null, warnings: [] }; });
  const connect = async () => {
    const client = new Client({ name: "research-test", version: "1" });
    const server = new McpServer({ name: "research-test", version: "1" });
    registerResearchTools(server, registry);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport); await client.connect(clientTransport);
    return { client, server };
  };
  const first = await connect(), second = await connect();
  try {
    const tools = (await first.client.listTools()).tools;
    assert.equal(tools.length, 10);
    assert.equal(tools.some(tool => /comments|reply/.test(tool.name)), false);
    assert.equal(tools.find(tool => tool.name === "read_social_post")?.annotations?.openWorldHint, true);
    const bad = await first.client.callTool({ name: "read_social_post", arguments: { url: "https://localhost/post/1" } });
    assert.equal(bad.isError, true); assert.equal(calls, 0);
    const start = await first.client.callTool({ name: "read_social_post", arguments: { url: "https://www.instagram.com/p/abc/", criteria: { minViews: 100_000, format: "slideshow" } } });
    const job = start.structuredContent as { jobId: string; sessionId: string };
    await new Promise(resolve => setImmediate(resolve));
    const read = await second.client.callTool({ name: "get_collection_job", arguments: { jobId: job.jobId } });
    assert.equal((read.structuredContent as { status: string }).status, "complete");
    assert.equal(calls, 1);
    const solve = await first.client.callTool({ name: "solve_collection_captcha", arguments: { jobId: job.jobId } });
    assert.equal(solve.isError, true);
    await second.client.callTool({ name: "close_collection_session", arguments: { sessionId: job.sessionId } });
    assert.equal((await first.client.callTool({ name: "get_collection_job", arguments: { jobId: job.jobId } })).isError, true);
  } finally { await first.client.close(); await first.server.close(); await second.client.close(); await second.server.close(); }
});
