import { registerProductionTools } from "./production/tools";
import { setToolPolicy, type ToolPolicy } from "./protocol/tools";
import { registerRenderJobTools } from "./tools/jobs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "./tools/projects";
import { registerVideoTools } from "./video/tools";
import { registerResearchTools } from "./research/tools";

export function createStudioMcpServer(
  origin: string,
  policy?: ToolPolicy,
  taskId?: string,
) {
  const server = new McpServer(
    { name: "content-studio", version: "0.1.0" },
    {
      instructions:
        "Read AGENTS.md for local execution, tool contracts and development rules. Before slideshow production read docs/content-guidelines.md; before research read docs/research-guidelines.md. Those documents own the workflow and quality criteria; tool descriptions own supported inputs and outputs. Slideshow and video tools are separate. Batch related slideshow edits in one edit_project call, use latest expectedTabId/expectedRevision, and review advisory warnings after writes. Create slides from the chosen content and actual reference images. clone_project duplicates an existing project independently. Use a unique requestId for create/clone/export operations and retry identical arguments with the same ID after a lost response. Tool failures provide structuredContent.error with code/details/recovery. Use API/MCP for ordinary content changes; never modify the DB directly without explicit user authorization. Do not request passwords or session tokens.",
    },
  );
  if (policy) setToolPolicy(server, policy);
  registerProductionTools(server, taskId, origin);
  registerRenderJobTools(server);
  registerProjectTools(server, origin);
  registerVideoTools(server, origin);
  registerResearchTools(server);
  return server;
}
