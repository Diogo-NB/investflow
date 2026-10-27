import {
  AlertTriangleIcon,
  SpinningRefreshIcon,
  XCircleIcon,
} from '../../ui/icons';
import { TAG_BASE } from '../../simulations/ui/calculation-status-tag';
import type { InvestmentPlanStatus } from '../models/investment-plan.types';

function Count({ value }: { readonly value: number }) {
  return <span className="tabular-nums">{value}</span>;
}

// Nothing when every member's result is current.
export function InvestmentPlanStatusTags({
  status,
}: {
  readonly status: InvestmentPlanStatus;
}) {
  if (status.isSettled) return null;
  return (
    <span className="flex flex-wrap gap-2">
      {status.calculatingCount > 0 && (
        <span
          className={`${TAG_BASE} border-accent/30 bg-accent-soft text-accent`}
        >
          <SpinningRefreshIcon className="size-4" />
          Em atualização <Count value={status.calculatingCount} />
        </span>
      )}
      {status.pendingIssueCount > 0 && (
        <span
          className={`${TAG_BASE} border-error/40 bg-error-soft text-error`}
        >
          <XCircleIcon className="size-4 shrink-0" />
          Com pendência <Count value={status.pendingIssueCount} />
        </span>
      )}
      {status.outdatedResultCount > 0 && (
        <span
          className={`${TAG_BASE} border-warning/40 bg-warning-soft text-warning`}
        >
          <AlertTriangleIcon className="size-4 shrink-0" />
          Resultados desatualizados <Count value={status.outdatedResultCount} />
        </span>
      )}
    </span>
  );
}
