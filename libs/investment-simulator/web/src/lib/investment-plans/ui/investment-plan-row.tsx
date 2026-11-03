import { Link } from 'react-router';
import { InvestmentPlanIcon } from '../../ui/icons';
import type { InvestmentPlanListItem } from '../models/investment-plan.types';
import { InvestmentPlanStatusTags } from './investment-plan-status-tags';

function simulationCountLabel(count: number): string {
  if (count === 0) return 'Nenhuma simulação';
  return count === 1 ? '1 simulação' : `${count} simulações`;
}

export function InvestmentPlanRow({
  plan,
}: {
  readonly plan: InvestmentPlanListItem;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={`/planos/${plan.id}`}
        className="group grid gap-2 p-4 text-fg no-underline transition-colors duration-150 hover:bg-accent-soft sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4"
      >
        <span className="flex min-w-0 items-start gap-3">
          <InvestmentPlanIcon className="mt-0.5 size-5 shrink-0 text-muted transition-colors duration-150 group-hover:text-accent" />
          <span className="grid min-w-0 gap-1">
            <span className="font-medium wrap-break-word text-accent group-hover:underline">
              {plan.name}
            </span>
            {plan.description && (
              <span className="line-clamp-2 text-sm wrap-break-word text-muted">
                {plan.description}
              </span>
            )}
          </span>
        </span>
        <span className="grid gap-2 pl-8 sm:justify-items-end sm:pl-0">
          <span className="text-sm text-muted">
            {simulationCountLabel(plan.simulationCount)}
          </span>
          <InvestmentPlanStatusTags status={plan.status} />
        </span>
      </Link>
    </li>
  );
}
