import { writeExportFile } from "@/lib/media/export/file";

export const writeVideoExport = (outputPath: string, overwrite: boolean, render: () => Promise<Buffer>, signal?: AbortSignal) =>
  writeExportFile(outputPath, overwrite, render, "mp4", signal);
