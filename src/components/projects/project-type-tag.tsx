export function ProjectTypeTag({ type = "slideshow" }: { type?: "slideshow" | "video" }) {
  return <span className="inline-flex shrink-0 items-center rounded border bg-muted/50 px-1.5 py-0.5 text-[10px] leading-none font-medium text-muted-foreground">{type}</span>;
}
