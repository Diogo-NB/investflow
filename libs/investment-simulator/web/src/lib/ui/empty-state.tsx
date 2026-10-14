import type { ReactNode } from 'react';
import { IconBadge } from './icon-badge';
import type { IconComponent } from './icons';

/** An empty or filtered-empty result: the aggregate's icon, copy, and actions. */
export function EmptyState({
  icon,
  children,
  actions,
}: {
  readonly icon: IconComponent;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="grid justify-items-start gap-4 p-6 motion-safe:animate-fade-in sm:grid-cols-[auto_1fr] sm:items-start">
      <IconBadge icon={icon} size="lg" />
      <div className="grid justify-items-start gap-4">
        <div className="m-0 max-w-prose">{children}</div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
