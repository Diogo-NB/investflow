import {
  AlertTriangleIcon,
  SpinningRefreshIcon,
  XCircleIcon,
} from '../../ui/icons';
import type { CalculationStatus } from '../models/simulation.types';
import { calculationStatusLabel } from '../utils/calculation-status';

export const TAG_BASE =
  'inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-sm font-medium';

// For an unsettled simulation only: a calculated one then has a stale result.
export function CalculationStatusTag({
  status,
}: {
  readonly status: CalculationStatus;
}) {
  const label = calculationStatusLabel(status);
  switch (status) {
    case 'PENDING':
      return (
        <span
          className={`${TAG_BASE} border-accent/30 bg-accent-soft text-accent`}
        >
          <SpinningRefreshIcon className="size-4" />
          {label}
        </span>
      );
    case 'INVALID':
      return (
        <span
          className={`${TAG_BASE} border-warning/40 bg-warning-soft text-warning`}
        >
          <AlertTriangleIcon className="size-4 shrink-0" />
          {label}
        </span>
      );
    case 'FAILED':
      return (
        <span
          className={`${TAG_BASE} border-error/40 bg-error-soft text-error`}
        >
          <XCircleIcon className="size-4 shrink-0" />
          {label}
        </span>
      );
    case 'CALCULATED':
      return (
        <span
          className={`${TAG_BASE} border-warning/40 bg-warning-soft text-warning`}
        >
          <AlertTriangleIcon className="size-4 shrink-0" />
          Desatualizado
        </span>
      );
  }
}
