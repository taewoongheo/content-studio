import { ContentJobRegistry } from "./registry";
import { ProjectAutosave } from "../projects/persistence/autosave";
import { EditorService } from "../editor/service";
const services = globalThis as typeof globalThis & { contentStudioEditorRegistry?: ContentJobRegistry; contentStudioProjectAutosave?: ProjectAutosave };
export const contentJobRegistry = services.contentStudioEditorRegistry ??= new ContentJobRegistry();
export const editorService = new EditorService(contentJobRegistry);
export const projectAutosave = services.contentStudioProjectAutosave ??= new ProjectAutosave(contentJobRegistry);
