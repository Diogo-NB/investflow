import type { ReactNode, SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

// Decorative: state is always also given as text.
function Icon({
  children,
  className = 'size-5 shrink-0',
  ...props
}: IconProps & { readonly children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16.25 10a6.25 6.25 0 0 1-11.1 3.94" />
      <path d="M3.75 10a6.25 6.25 0 0 1 11.1-3.94" />
      <path d="M15.25 2.75v3.5h-3.5" />
      <path d="M4.75 17.25v-3.5h3.5" />
    </Icon>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7.25" />
      <path d="m6.75 10.25 2.25 2.25 4.25-4.5" />
    </Icon>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.7 3.5 2.4 14.5a1.5 1.5 0 0 0 1.3 2.25h12.6a1.5 1.5 0 0 0 1.3-2.25L11.3 3.5a1.5 1.5 0 0 0-2.6 0Z" />
      <path d="M10 8v3.5" />
      <circle cx="10" cy="13.9" r="0.4" fill="currentColor" />
    </Icon>
  );
}

export function XCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7.25" />
      <path d="m7.5 7.5 5 5m0-5-5 5" />
    </Icon>
  );
}

// Spins only when the user allows motion; it still reads as "refresh" when
// still.
export function SpinningRefreshIcon({ className = 'size-5' }: IconProps) {
  return (
    <RefreshIcon className={`${className} shrink-0 motion-safe:animate-spin`} />
  );
}
