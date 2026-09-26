import { REFERENCE_ROLES, type ReferenceRole } from "@/lib/content-jobs/domain/types";

export const MAX_REFERENCE_IMAGES = 20;
export const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;
const REFERENCE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateReferenceImages(
  existingCount: number,
  incoming: readonly Pick<File, "size" | "type">[],
): string {
  if (existingCount + incoming.length > MAX_REFERENCE_IMAGES)
    return `레퍼런스 이미지는 최대 ${MAX_REFERENCE_IMAGES}장까지 추가할 수 있습니다.`;
  if (
    incoming.some(
      (file) =>
        !REFERENCE_IMAGE_TYPES.includes(file.type) ||
        file.size === 0 ||
        file.size > MAX_REFERENCE_IMAGE_BYTES,
    )
  )
    return "PNG, JPG, WebP 이미지를 장당 10MB 이하로 추가해 주세요.";
  return "";
}

export function validateReference(files: File[], slideCount?: number) {
  if (files.length === 0) return "레퍼런스 슬라이드를 순서대로 추가해 주세요.";
  if (slideCount !== undefined && files.length !== slideCount)
    return `장면별 구성은 ${slideCount}장의 레퍼런스 이미지를 추가해 주세요.`;
  return "";
}

export function validateRepeatingReference(
  images: readonly { role: ReferenceRole }[],
) {
  const roles = images.map((image) => image.role);
  if (
    roles.length === REFERENCE_ROLES.length &&
    REFERENCE_ROLES.every((role) => roles.includes(role))
  )
    return "";
  if (REFERENCE_ROLES.some((role) => !roles.includes(role)))
    return "훅, 반복 본문, CTA 이미지를 모두 추가해 주세요.";
  return "훅, 반복 본문, CTA 이미지를 하나씩만 추가해 주세요.";
}
