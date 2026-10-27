import type { ReactNode } from 'react';
import { IconBadge } from './icon-badge';
import type { IconComponent } from './icons';

export function PageTitle({
  id,
  icon,
  children,
  subtitle,
}: {
  readonly id: string;
  readonly icon: IconComponent;
  readonly children: ReactNode;
  readonly subtitle?: ReactNode;
}) {
  return (
    <div className="flex max-w-prose items-start gap-4">
      <IconBadge icon={icon} />
      <div className="min-w-0">
        <h1
          id={id}
          className="m-0 text-xl/tight font-semibold sm:text-2xl/tight"
        >
          {children}
        </h1>
        {subtitle && <p className="mt-2 mb-0 text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
