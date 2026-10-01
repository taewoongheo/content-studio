import { FormField } from "../form-field";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CONTENT_SIZE_PRESETS, type ContentSettings as Settings } from "./model";

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

function RatioSetting({ value, onChange }: { value: Settings["ratio"]; onChange: (value: Settings["ratio"]) => void }) {
  return (
    <FormField>
      <Label htmlFor="ratio">화면 크기</Label>
      <NativeSelect id="ratio" value={value}
        onChange={(event) => onChange(event.target.value as Settings["ratio"])}>
        {CONTENT_SIZE_PRESETS.map((preset) => (
          <NativeSelectOption key={preset.ratio} value={preset.ratio}>
            {preset.label}
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
        <RatioSetting value={value.ratio} onChange={(ratio) => onChange({ ratio })} />
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
