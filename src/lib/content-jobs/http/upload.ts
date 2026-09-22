import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import type { ContentJobInput, ProductContextInput } from "../domain/types";

export const MAX_REFERENCE_IMAGES = 20;
export const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;

const imageTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

export class ContentJobInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentJobInputError";
  }
}

function parseProductContext(value: FormDataEntryValue | null) {
  if (typeof value !== "string")
    throw new ContentJobInputError("제품 정보가 필요합니다.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ContentJobInputError("제품 정보를 읽을 수 없습니다.");
  }
  if (typeof parsed !== "object" || parsed === null)
    throw new ContentJobInputError("제품 정보가 올바르지 않습니다.");
  const data = parsed as Record<string, unknown>;
  const fields: Array<[keyof ProductContextInput, number, boolean]> = [
    ["name", 80, true],
    ["description", 2000, true],
    ["audience", 200, false],
    ["constraints", 2000, false],
  ];
  for (const [key, maxLength, required] of fields) {
    const field = data[key];
    if (
      typeof field !== "string" ||
      field.length > maxLength ||
      (required && !field.trim())
    )
      throw new ContentJobInputError("제품 정보가 올바르지 않습니다.");
  }
  return data as ProductContextInput;
}

function validSignature(type: keyof typeof imageTypes, bytes: Uint8Array) {
  if (type === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  return (
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  );
}

function parseImages(formData: FormData) {
  const images = formData.getAll("images").filter(
    (entry): entry is File => entry instanceof File,
  );
  if (images.length === 0 || images.length > MAX_REFERENCE_IMAGES)
    throw new ContentJobInputError(
      `레퍼런스 이미지는 1장 이상 ${MAX_REFERENCE_IMAGES}장 이하로 추가해 주세요.`,
    );
  return images;
}

export async function saveContentJobInput(formData: FormData): Promise<{
  input: ContentJobInput;
  cleanup: () => Promise<void>;
}> {
  const productContext = parseProductContext(formData.get("productContext"));
  const aspectRatio = formData.get("aspectRatio");
  if (aspectRatio !== "4:5" && aspectRatio !== "1:1" && aspectRatio !== "9:16")
    throw new ContentJobInputError("화면 비율을 확인해 주세요.");
  const slideCount = Number(formData.get("slideCount"));
  if (!Number.isInteger(slideCount) || slideCount < 4 || slideCount > 10)
    throw new ContentJobInputError("슬라이드 수는 4장부터 10장까지입니다.");
  const outputLanguage = formData.get("outputLanguage");
  if (
    typeof outputLanguage !== "string" ||
    !outputLanguage.trim() ||
    outputLanguage.length > 50
  )
    throw new ContentJobInputError("결과 언어를 확인해 주세요.");
  const images = parseImages(formData);
  const buffers = await Promise.all(
    images.map(async (image) => {
      if (
        !(image.type in imageTypes) ||
        image.size === 0 ||
        image.size > MAX_REFERENCE_IMAGE_BYTES
      )
        throw new ContentJobInputError(
          "PNG, JPG, WebP 이미지를 장당 10MB 이하로 추가해 주세요.",
        );
      const buffer = new Uint8Array(await image.arrayBuffer());
      if (!validSignature(image.type as keyof typeof imageTypes, buffer))
        throw new ContentJobInputError("이미지 파일 형식을 확인해 주세요.");
      return { image, buffer };
    }),
  );
  const directory = await mkdtemp(join(tmpdir(), "content-studio-job-"));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    const referenceImages = await Promise.all(
      buffers.map(async ({ image, buffer }, index) => {
        const id = `image-${index + 1}`;
        const type = image.type as keyof typeof imageTypes;
        const path = join(directory, `${id}${imageTypes[type]}`);
        await writeFile(path, buffer, { flag: "wx" });
        return {
          id,
          name: image.name || `reference-${index + 1}${extname(path)}`,
          path,
          type,
          size: image.size,
        };
      }),
    );
    return {
      input: {
        productContext,
        aspectRatio,
        slideCount,
        outputLanguage: outputLanguage.trim(),
        referenceImages,
      },
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
