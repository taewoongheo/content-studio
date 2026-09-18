import type { ReactNode } from "react";

export function FormField({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5 [&_label]:text-sm [&_label]:leading-normal [&_input]:min-h-11 [&_select]:min-h-11 [&_textarea]:min-h-28 [&_textarea]:resize-y [&_textarea]:p-3 [&_textarea]:leading-relaxed [&_input]:bg-background [&_textarea]:bg-background [&_select]:bg-background [&_[data-slot=native-select-wrapper]]:w-full max-md:[&_input]:text-base max-md:[&_textarea]:text-base max-md:[&_select]:text-base">
      {children}
    </div>
  );
}
