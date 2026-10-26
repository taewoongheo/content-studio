import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { researchRegistry } from "@/domains/research/collection/service";
import { registerCollectionTools } from "./tools/gather/collection";
import { registerJobsTools } from "./tools/control/jobs";
import { registerImagesTools } from "./tools/gather/images";
import { registerLifecycleTools } from "./tools/control/lifecycle";
import { registerSearchTools } from "./tools/gather/search";
import type { CollectionRegistry } from "@/domains/research/collection/registry";

export function registerResearchTools(server: McpServer, registry: CollectionRegistry = researchRegistry) {
  registerCollectionTools(server, registry);
  registerJobsTools(server, registry);
  registerImagesTools(server, registry);
  registerLifecycleTools(server, registry);
  registerSearchTools(server, registry);
}
