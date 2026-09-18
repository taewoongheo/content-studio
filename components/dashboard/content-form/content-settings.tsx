import { FormField } from "./form-field";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  contentTypes,
  type ContentType,
  type ContentSettings as Settings,
} from "./model";

function Setting({
  id,
  label,
  value,
  options,
  onChange,
  description,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  description?: string;
}) {
  return (
    <FormField>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        name={id}
        value={value}
        aria-describedby={description ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {description && (
        <p
          id={`${id}-hint`}
          className="text-sm leading-6 text-muted-foreground"
        >
          {description}
        </p>
      )}
    </FormField>
  );
}

export function ContentSettings({
  type,
  value,
  onChange,
}: {
  type: ContentType;
  value: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const { ratio, count, videoRatio, duration, channel, length, language } =
    value;
  const typeTitle = contentTypes.find((item) => item.id === type)!.title;
  return (
    <section
      className="grid gap-4 rounded-lg bg-surface-subtle p-6 max-md:p-4"
      aria-labelledby="settings-heading"
    >
      <div className="grid gap-2">
        <h2 id="settings-heading" className="text-base font-semibold">
          {typeTitle} 설정
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {type === "text"
            ? "게시할 곳과 원하는 글의 분량에 맞춰 설정하세요."
            : "게시할 화면과 원하는 콘텐츠 길이에 맞춰 설정하세요."}{" "}
          기본값을 그대로 사용해도 됩니다.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        {type === "slideshow" && (
          <>
            <Setting
              id="ratio"
              description="4:5는 세로 피드, 1:1은 정사각형, 9:16은 전체 화면입니다."
              label="화면 비율"
              value={ratio}
              onChange={(value) => onChange({ ratio: value })}
              options={["4:5", "1:1", "9:16"]}
            />
            <Setting
              id="count"
              description="커버와 마지막 장을 포함한 전체 장수입니다."
              label="슬라이드 수"
              value={count}
              onChange={(value) => onChange({ count: value })}
              options={["4장", "5장", "6장", "7장", "8장", "9장", "10장"]}
            />
          </>
        )}
        {type === "video" && (
          <>
            <Setting
              id="video-ratio"
              description="9:16은 세로 영상, 16:9는 가로 영상입니다."
              label="화면 비율"
              value={videoRatio}
              onChange={(value) => onChange({ videoRatio: value })}
              options={["9:16", "16:9", "1:1"]}
            />
            <Setting
              id="duration"
              description="영상 구성과 대본을 맞출 목표 길이입니다."
              label="목표 영상 길이"
              value={duration}
              onChange={(value) => onChange({ duration: value })}
              options={["15초", "30초", "60초"]}
            />
          </>
        )}
        {type === "text" && (
          <>
            <Setting
              id="channel"
              description="게시할 곳에 맞는 글의 구조를 정합니다."
              label="글 유형"
              value={channel}
              onChange={(value) => onChange({ channel: value })}
              options={["SNS 게시글", "블로그 글", "제품 소개 글"]}
            />
            <Setting
              id="length"
              description="생성 시 참고할 대략적인 분량입니다."
              label="목표 분량"
              value={length}
              onChange={(value) => onChange({ length: value })}
              options={[
                "짧게 · 약 200자",
                "보통 · 약 500자",
                "길게 · 약 1,500자",
              ]}
            />
          </>
        )}
        <Setting
          id="language"
          description="결과물에 사용할 언어입니다."
          label="콘텐츠 언어"
          value={language}
          onChange={(value) => onChange({ language: value })}
          options={["한국어", "English"]}
        />
      </div>
    </section>
  );
}
