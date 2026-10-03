import type { ReactNode } from "react";

export function ReviewShell({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-6" aria-labelledby="review-title">
      <header className="grid gap-2 border-b pb-6">
        <p className="text-sm font-medium text-muted-foreground">{step}</p>
        <h1 id="review-title" className="text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </header>
      {children}
    </section>
  );
}
