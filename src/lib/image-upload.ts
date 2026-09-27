export const MAX_UPLOAD_IMAGE_BYTES = 10 * 1024 * 1024;

const supportedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export function selectUploadImage(files: ArrayLike<File> | null):
  | { file: File; error: null }
  | { file: null; error: string } {
  if (!files || files.length !== 1)
    return { file: null, error: "이미지를 한 장만 선택해 주세요." };
  const file = files[0];
  if (!supportedTypes.has(file.type) || file.size === 0 || file.size > MAX_UPLOAD_IMAGE_BYTES)
    return { file: null, error: "PNG, JPG, WebP 이미지를 10MB 이하로 선택해 주세요." };
  return { file, error: null };
}
