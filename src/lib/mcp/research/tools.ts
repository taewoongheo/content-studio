import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { researchRegistry } from "@/domains/research/collection/service";
import { researchAccounts } from "@/domains/research/accounts/service";
import { registerCollectionTools } from "./tools/gather/collection";
import { registerJobsTools } from "./tools/control/jobs";
import { registerImagesTools } from "./tools/gather/images";
import { registerBrowserTools } from "./tools/control/browser";
import { registerLifecycleTools } from "./tools/control/lifecycle";
import { registerSearchTools } from "./tools/gather/search";
import type { CollectionRegistry } from "@/domains/research/collection/registry";
import type { AccountManager } from "@/domains/research/accounts/manager";

export function registerResearchTools(server: McpServer, registry: CollectionRegistry = researchRegistry, accounts: AccountManager = researchAccounts) {
  registerCollectionTools(server, registry);
  registerJobsTools(server, registry);
  registerImagesTools(server, registry);
  registerBrowserTools(server, registry);
  registerLifecycleTools(server, registry);
  registerSearchTools(server, registry, accounts);
}
