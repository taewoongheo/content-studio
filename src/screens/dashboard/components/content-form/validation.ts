import type { ContentType, Materials, Method } from "./model";

export const MAX_REFERENCE_IMAGES = 5;
export const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;
const REFERENCE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateReferenceImages(
  existingCount: number,
  incoming: readonly Pick<File, "size" | "type">[],
): string {
  const tooManyImages = existingCount + incoming.length > MAX_REFERENCE_IMAGES;
  const hasUnsupportedImage = incoming.some(
    (file) =>
      !REFERENCE_IMAGE_TYPES.includes(file.type) ||
      file.size > MAX_REFERENCE_IMAGE_BYTES,
  );
  if (tooManyImages || hasUnsupportedImage) {
    return "PNG, JPG, WebP 이미지를 장당 10MB 이하로, 최대 5장 선택해 주세요.";
  }
  return "";
}

export function validateMaterials(
  type: ContentType,
  method: Method,
  materials: Materials,
): string {
  if (method !== "reference") return "";

  const { reference, referenceText, files } = materials;
  const imageReferences = type === "slideshow";
  const hasMaterial = Boolean(
    reference.trim() || (imageReferences ? files.length : referenceText.trim()),
  );
  if (!hasMaterial) {
    return imageReferences
      ? "레퍼런스 링크 또는 이미지를 추가해 주세요."
      : "레퍼런스 링크 또는 참고할 내용을 입력해 주세요.";
  }
  if (!reference.trim()) return "";

  try {
    const url = new URL(reference);
    if (["http:", "https:"].includes(url.protocol)) return "";
  } catch {
    // Invalid URLs and unsupported protocols share the same correction.
  }
  return "http:// 또는 https://로 시작하는 링크를 입력해 주세요.";
}
