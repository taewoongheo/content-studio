import { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import { ProjectAutosave } from "@/domains/slideshow/projects/persistence/autosave";
import { EditorService } from "@/domains/slideshow/editor/service";
const services = globalThis as typeof globalThis & { contentStudioEditorRegistry?: ContentJobRegistry; contentStudioProjectAutosave?: ProjectAutosave };
export const contentJobRegistry = services.contentStudioEditorRegistry ??= new ContentJobRegistry();
export const editorService = new EditorService(contentJobRegistry);
export const projectAutosave = services.contentStudioProjectAutosave ??= new ProjectAutosave(contentJobRegistry);
