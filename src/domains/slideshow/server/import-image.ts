import type Database from "better-sqlite3";
import type { ContentJobRegistry } from "../workflow/registry";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SlideshowProjectWrites } from "./project-writes";
export async function importSlideshowImage(
  registry: ContentJobRegistry,
  db: Database.Database,
  input: {
    projectId: string;
    slideId: string;
    placementId: string;
    expectedRevision: number;
    expectedTabId: string;
  },
  bytes: Buffer,
) {
  const directory = await mkdtemp(join(tmpdir(), "studio-image-import-")),
    path = join(directory, "image.webp");
  try {
    await writeFile(path, bytes);
    return await new SlideshowProjectWrites(registry, db).edit(
      input.projectId,
      [
        {
          type: "set_local_image",
          slideId: input.slideId,
          placementId: input.placementId,
          localPath: path,
        },
      ],
      input.expectedRevision,
      input.expectedTabId,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
