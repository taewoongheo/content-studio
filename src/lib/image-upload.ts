export const MAX_UPLOAD_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_CHAT_IMAGES = 10;

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

export function selectChatUploadImages(existing: File[], incoming: ArrayLike<File> | null):
  | { files: File[]; error: null }
  | { files: null; error: string } {
  const additions = Array.from(incoming ?? []);
  if (additions.length === 0) return { files: null, error: "이미지를 선택해 주세요." };
  if (existing.length + additions.length > MAX_CHAT_IMAGES)
    return { files: null, error: `채팅에는 이미지를 최대 ${MAX_CHAT_IMAGES}장까지 첨부할 수 있습니다.` };
  for (const file of additions) {
    const result = selectUploadImage([file]);
    if (result.error) return { files: null, error: result.error };
  }
  return { files: [...existing, ...additions], error: null };
}
