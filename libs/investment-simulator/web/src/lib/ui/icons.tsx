import type { ReactNode, SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

export type IconComponent = (props: IconProps) => ReactNode;

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

// Canonical aggregate icons: each one always stands for its aggregate, in the
// header, page titles, lists, and empty states.

export function SimulationIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.25" y="2.75" width="11.5" height="14.5" rx="1.75" />
      <rect x="6.75" y="5.25" width="6.5" height="2.75" rx="0.5" />
      <path d="M7.25 11h.01M10 11h.01M12.75 11h.01M7.25 14h.01M10 14h.01M12.75 14h.01" />
    </Icon>
  );
}

export function OfferIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.75 9.6V4.25a1.5 1.5 0 0 1 1.5-1.5h6.35a1.5 1.5 0 0 1 1.06.44l4.6 4.6a1.5 1.5 0 0 1 0 2.12l-5.85 5.85a1.5 1.5 0 0 1-2.12 0l-5.1-5.1a1.5 1.5 0 0 1-.44-1.06Z" />
      <circle cx="7.25" cy="6.25" r="1.1" />
    </Icon>
  );
}

export function CurveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.25 3.25v13.5h13.5" />
      <path d="M5.75 13.75c2.25-.25 3.25-1.75 4.25-4.25s2.25-4.25 5.75-4.5" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 4.25v11.5M4.25 10h11.5" />
    </Icon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12.9 3.6a1.77 1.77 0 0 1 2.5 2.5l-8.65 8.65-3.25.75.75-3.25Z" />
      <path d="m11.75 4.75 2.5 2.5" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6.75" y="6.75" width="9.5" height="9.5" rx="1.5" />
      <path d="M13.25 6.75V5A1.25 1.25 0 0 0 12 3.75H5A1.25 1.25 0 0 0 3.75 5v7A1.25 1.25 0 0 0 5 13.25h1.75" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.25" y="8.75" width="11.5" height="8" rx="1.5" />
      <path d="M6.75 8.75V6.5a3.25 3.25 0 0 1 6.5 0v2.25" />
    </Icon>
  );
}

export function SplitIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.75" y="5.75" width="5.5" height="8.5" rx="1" />
      <rect x="11.75" y="5.75" width="5.5" height="8.5" rx="1" />
      <path d="M10 3.75v12.5" strokeDasharray="1.5 1.5" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.75 5.75h12.5M8 5.75v-1.5h4v1.5" />
      <path d="m5.25 5.75.7 9.6a1.5 1.5 0 0 0 1.5 1.4h5.1a1.5 1.5 0 0 0 1.5-1.4l.7-9.6" />
      <path d="M8.5 9v4.5m3-4.5v4.5" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8.75" cy="8.75" r="5" />
      <path d="m12.5 12.5 3.75 3.75" />
    </Icon>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 5h13M6 10h8m-5.5 5h3" />
    </Icon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10h12m-4.5-4.5L16 10l-4.5 4.5" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 5-5 5 5 5" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m8 5 5 5-5 5" />
    </Icon>
  );
}
