import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
export const inputClass = "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const control = isValidElement(children) && typeof children.type === "string" && ["input", "textarea", "select"].includes(children.type);
  return <div className="grid min-w-0 gap-1.5 text-xs font-medium">{control ? <label htmlFor={id}>{label}</label> : <span>{label}</span>}{control ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}</div>;
}
export function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  return <Field label={label}><input aria-label={label} className={inputClass} type="number" value={Number(value.toFixed(3))} min={min} max={max} step={step}
    onChange={e => { if (e.target.value === "") return; const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))); }} /></Field>;
}
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><div className="flex items-center gap-2"><input aria-label={label} type="color" className="h-10 w-10 shrink-0 cursor-pointer rounded border" value={value} onChange={e => onChange(e.target.value)} /><span className="font-mono text-xs">{value}</span></div></Field>;
}
