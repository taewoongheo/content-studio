const services = globalThis as typeof globalThis & { contentStudioPreviewQueue?: Promise<void> };

/** Shared across request handlers and dev reloads; failed renders also release the next caller. */
export async function serializePreview<T>(render: () => Promise<T>): Promise<T> {
  const previous = services.contentStudioPreviewQueue ?? Promise.resolve();
  let release!: () => void;
  services.contentStudioPreviewQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await render(); }
  finally { release(); }
}
