import { FormField } from "../form-field";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { ContentSettings as Settings } from "./model";

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
  onChange,
}: {
  value: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  return (
    <section className="grid gap-4 rounded-lg bg-surface-subtle p-6 max-md:p-4" aria-labelledby="settings-heading">
      <div className="grid gap-2">
        <h2 id="settings-heading" className="text-base font-semibold">
          TikTok 슬라이드쇼 설정
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          업로드한 이미지 순서와 장수로 슬라이드를 구성합니다.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Setting
          id="ratio"
          label="화면 비율"
          value={value.ratio}
          onChange={(ratio) => onChange({ ratio: ratio as Settings["ratio"] })}
          options={["9:16", "4:5", "1:1"]}
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
