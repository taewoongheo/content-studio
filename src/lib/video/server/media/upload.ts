import { imageTypes, validSignature } from "../../../content-jobs/http/upload";

export const videoMediaTypes = new Set(["video/mp4", "video/quicktime", "video/webm", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac", "audio/ogg", "image/png", "image/jpeg", "image/webp"]);
/** Verify container signatures instead of trusting multipart MIME declarations. */
export function validateVideoUpload(type: string, bytes: Buffer) {
  const tag = (start: number, end: number) => bytes.toString("ascii", start, end);
  let matches = false;
  if (type in imageTypes) matches = validSignature(type as keyof typeof imageTypes, bytes);
  else if (type === "video/mp4" || type === "audio/mp4" || type === "video/quicktime") {
    if (bytes.length >= 16 && tag(4, 8) === "ftyp") {
      const boxSize = bytes.readUInt32BE(0);
      const brands = [tag(8, 12)];
      for (let at = 16; at + 4 <= Math.min(boxSize, bytes.length, 256); at += 4) brands.push(tag(at, at + 4));
      const quicktime = brands.includes("qt  ");
      matches = type === "video/quicktime" ? quicktime : !quicktime && brands.some(brand => /^(isom|iso[2-9]|mp4[12]|avc1|M4[AVBP] |dash|MSNV)$/.test(brand));
    }
  } else if (type === "video/webm") matches = bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && bytes.subarray(0, 4096).includes(Buffer.from("webm"));
  else if (type === "audio/wav" || type === "audio/x-wav") matches = tag(0, 4) === "RIFF" && tag(8, 12) === "WAVE";
  else if (type === "audio/ogg") matches = tag(0, 4) === "OggS";
  else if (type === "audio/mpeg") matches = tag(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0);
  else if (type === "audio/aac") matches = bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
  if (!bytes.length || !videoMediaTypes.has(type) || !matches) throw new Error("파일 내용과 미디어 형식이 일치하지 않습니다.");
}
