import { researchAccounts } from "../accounts/service";
import { collectSocial } from "../collectors";
import { clearYouTubeSession } from "../collectors/platforms/youtube";
import { CollectionRegistry } from "./registry";

const services = globalThis as typeof globalThis & { contentStudioResearchRegistry?: CollectionRegistry };
export const researchRegistry = services.contentStudioResearchRegistry ??= new CollectionRegistry(collectSocial, clearYouTubeSession, researchAccounts);
