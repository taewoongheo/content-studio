import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function ChoiceSection<T extends string>({
  name,
  idPrefix,
  title,
  value,
  options,
  onChange,
}: {
  name: string;
  idPrefix: string;
  title: string;
  value: T;
  options: readonly { id: T; title: string; description: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <section aria-labelledby={`${name}-heading`} className="grid gap-3">
      <h2 id={`${name}-heading`} className="text-base font-semibold">
        {title}
      </h2>
      <RadioGroup
        name={name}
        aria-labelledby={`${name}-heading`}
        value={value}
        className="grid grid-cols-3 gap-3 max-lg:grid-cols-1"
        onValueChange={(value) => {
          const option = options.find((option) => option.id === value);
          if (option) onChange(option.id);
        }}
      >
        {options.map(({ id, title, description }) => (
          <Label
            key={id}
            htmlFor={`${idPrefix}-${id}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted has-data-checked:border-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
          >
            <RadioGroupItem
              id={`${idPrefix}-${id}`}
              value={id}
              className="mt-0.5"
              aria-describedby={`${idPrefix}-${id}-hint`}
            />
            <span>
              <span className="text-sm font-medium leading-5">{title}</span>
              <span
                id={`${idPrefix}-${id}-hint`}
                className="mt-2 block text-sm font-normal leading-6 text-muted-foreground"
              >
                {description}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>
    </section>
  );
}
