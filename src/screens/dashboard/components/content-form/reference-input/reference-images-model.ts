export type ReferenceImageDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

export function createReferenceImageDrafts(
  files: File[],
  createId: () => string = () => crypto.randomUUID(),
  createPreviewUrl: (file: File) => string = (file) =>
    URL.createObjectURL(file),
) {
  return files.map((file) => ({
    id: createId(),
    file,
    previewUrl: createPreviewUrl(file),
  }));
}

export function reorderReferenceImages(
  images: ReferenceImageDraft[],
  activeId: string,
  overId: string,
) {
  const fromIndex = images.findIndex((image) => image.id === activeId);
  const toIndex = images.findIndex((image) => image.id === overId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return images;

  const reordered = [...images];
  const [activeImage] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, activeImage);
  return reordered;
}
