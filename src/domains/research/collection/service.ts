import { collectSocial } from "@/domains/research/collectors/index";
import { clearYouTubeSession } from "@/domains/research/collectors/platforms/youtube";
import { CollectionRegistry } from "./registry";

const services = globalThis as typeof globalThis & { contentStudioYouTubeRegistry?: CollectionRegistry };
export const researchRegistry = services.contentStudioYouTubeRegistry ??= new CollectionRegistry(collectSocial, clearYouTubeSession);
