import type { ReactNode } from 'react';
import type { IconComponent } from './icons';

export function PageLabel({
  icon: Icon,
  children,
}: {
  readonly icon?: IconComponent;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted">
      <span className="flex items-center gap-2">
        {Icon && <Icon className="size-4 shrink-0" />}
        {children}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}
