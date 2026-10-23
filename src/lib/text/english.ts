import { francAll } from "franc-min";
import { OperationError } from "@/lib/errors/operation";
import { isDataField } from "./fields";

export function assertEnglish(value: unknown, path = "output"): void {
  if (typeof value === "string") {
    const text = value.replace(/https?:\/\/[^\s)\]]+/g, "").trim();
    // Non-Latin prose is unambiguous even when embedded in English.
    if (/[^\p{Script=Latin}\p{Mark}\P{Letter}]/u.test(text))
      throw new OperationError("ENGLISH_REQUIRED", `ENGLISH_REQUIRED: ${path} must be written in English. Translate the text before saving.`, { path });
    for (const part of [text, ...text.split(/[.!?\n]+/)]) {
      if ((part.match(/[a-z]+/gi)?.length ?? 0) < 3) continue;
      const languages = francAll(part), first = languages[0];
      const english = languages.find(([language]) => language === "eng")?.[1] ?? 0;
      // Short exercise names and units have little language evidence. Reject a
      // detected foreign language only with a clear lead over English.
      if (first && first[0] !== "eng" && first[0] !== "und" && first[1] - english > 0.5)
        throw new OperationError("ENGLISH_REQUIRED", `ENGLISH_REQUIRED: ${path} was detected as ${first[0]}. Rewrite it in English before saving.`, { path, language: first[0] });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => assertEnglish(item, `${path}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (/[^\x00-\x7F]/.test(key))
        throw new OperationError("ENGLISH_REQUIRED", `ENGLISH_REQUIRED: ${path} contains a non-English field name.`, { path });
      if (!isDataField(key)) assertEnglish(item, `${path}.${key}`);
    }
  }
}
