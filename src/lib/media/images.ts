export const MAX_UPLOAD_IMAGE_BYTES = 10 * 1024 * 1024;
export const imageTypes = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" } as const;
export function validSignature(type: keyof typeof imageTypes, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    .every((value, index) => bytes[index] === value);
  return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}
