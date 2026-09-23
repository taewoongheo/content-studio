import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function ChoiceSection<T extends string>({
  name,
  title,
  value,
  columns,
  options,
  onChange,
}: {
  name: string;
  title: string;
  value: T;
  columns: 2 | 3;
  options: readonly { id: T; title: string; description: string }[];
  onChange: (value: T) => void;
}) {
  const headingId = `${name}-heading`;
  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      <RadioGroup
        name={name}
        aria-labelledby={headingId}
        value={value}
        className={
          columns === 2
            ? "grid grid-cols-2 gap-3 max-md:grid-cols-1"
            : "grid grid-cols-3 gap-3 max-lg:grid-cols-1"
        }
        onValueChange={(nextValue) => {
          const option = options.find((item) => item.id === nextValue);
          if (option) onChange(option.id);
        }}
      >
        {options.map((option) => {
          const optionId = `${name}-${option.id}`;
          return (
            <Label
              key={option.id}
              htmlFor={optionId}
              className="flex min-h-24 cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted has-data-checked:border-foreground has-data-checked:ring-1 has-data-checked:ring-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
            >
              <RadioGroupItem
                id={optionId}
                value={option.id}
                className="mt-0.5"
                aria-describedby={`${optionId}-description`}
              />
              <span className="grid gap-1">
                <span className="text-sm font-medium">{option.title}</span>
                <span
                  id={`${optionId}-description`}
                  className="text-sm font-normal leading-5 text-muted-foreground"
                >
                  {option.description}
                </span>
              </span>
            </Label>
          );
        })}
      </RadioGroup>
    </section>
  );
}
