import { ContentJobRegistry } from "./registry";
import { EditorService } from "../editor/service";
const services = globalThis as typeof globalThis & { contentStudioEditorRegistry?: ContentJobRegistry };
export const contentJobRegistry = services.contentStudioEditorRegistry ??= new ContentJobRegistry();
export const editorService = new EditorService(contentJobRegistry);
