import { researchAccounts } from "@/domains/research/accounts/service";
import { collectSocial } from "@/domains/research/collectors/index";
import { clearYouTubeSession } from "@/domains/research/collectors/platforms/youtube";
import { CollectionRegistry } from "@/domains/research/collection/registry";

const services = globalThis as typeof globalThis & { contentStudioResearchRegistry?: CollectionRegistry };
export const researchRegistry = services.contentStudioResearchRegistry ??= new CollectionRegistry(collectSocial, clearYouTubeSession, researchAccounts);
