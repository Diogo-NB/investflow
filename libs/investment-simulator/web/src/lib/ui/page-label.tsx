import type { ReactNode } from 'react';

export function PageLabel({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted">
      <span>{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}
