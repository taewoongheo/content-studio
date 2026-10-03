import { FormField } from "../form-field";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { ContentSettings as Settings } from "./model";
import type { SlideshowStructure } from "@/lib/content-jobs/domain/types";

function Setting({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <FormField>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </FormField>
  );
}

export function ContentSettings({
  value,
  structure,
  onChange,
}: {
  value: Settings;
  structure: SlideshowStructure;
  onChange: (patch: Partial<Settings>) => void;
}) {
  return (
    <section className="grid gap-4 rounded-lg bg-surface-subtle p-6 max-md:p-4" aria-labelledby="settings-heading">
      <div className="grid gap-2">
        <h2 id="settings-heading" className="text-base font-semibold">
          TikTok 슬라이드쇼 설정
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {structure === "repeating"
            ? "총 장수에는 훅 1장과 CTA 1장이 포함됩니다. 나머지는 같은 포맷의 본문입니다."
            : "게시 화면, 결과 장수와 사용할 언어를 정하세요."}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <Setting
          id="ratio"
          label="화면 비율"
          value={value.ratio}
          onChange={(ratio) => onChange({ ratio: ratio as Settings["ratio"] })}
          options={["9:16", "4:5", "1:1"]}
        />
        <Setting
          id="count"
          label="슬라이드 수"
          value={value.count}
          onChange={(count) => onChange({ count })}
          options={["4장", "5장", "6장", "7장", "8장", "9장", "10장"]}
        />
        <Setting
          id="language"
          label="결과 언어"
          value={value.language}
          onChange={(language) =>
            onChange({ language: language as Settings["language"] })
          }
          options={["한국어", "English"]}
        />
      </div>
    </section>
  );
}
