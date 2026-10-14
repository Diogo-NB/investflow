import type { IconComponent } from './icons';

const SIZES = {
  md: { box: 'size-10', icon: 'size-5' },
  lg: { box: 'size-14', icon: 'size-7' },
};

/** An aggregate's icon on its accent tile, beside a title or an empty state. */
export function IconBadge({
  icon: Icon,
  size = 'md',
}: {
  readonly icon: IconComponent;
  readonly size?: keyof typeof SIZES;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size].box} flex shrink-0 items-center justify-center rounded-surface bg-accent-soft text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-accent-fg`}
    >
      <Icon className={`${SIZES[size].icon} shrink-0`} />
    </span>
  );
}
