import { Fragment, lazy, Suspense, useState } from 'react';
import { formatIsoDate, formatMonth } from '../../dates/calendar-date';
import { formatMoney } from '../../decimals/format-decimal';
import type { MonthlyBalance } from '../models/simulation.types';

const CELL = 'px-3 py-2 text-right';

// Keeps the charting library out of the workspace chunk until the section opens.
const MonthlyBalanceChart = lazy(() =>
  import('./monthly-balance-chart').then((module) => ({
    default: module.MonthlyBalanceChart,
  })),
);

// Rows render only while the section is open.
export function MonthlyBalanceTable({
  months,
}: {
  readonly months: readonly MonthlyBalance[];
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  function toggle(month: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  return (
    <details
      className="border-t border-border"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-11 cursor-pointer items-center px-6 font-medium text-accent">
        Evolução do saldo ({months.length}{' '}
        {months.length === 1 ? 'mês' : 'meses'})
      </summary>
      {open && (
        <Suspense
          fallback={
            <p className="m-0 border-t border-border px-6 py-3 text-sm text-muted">
              Carregando o gráfico…
            </p>
          }
        >
          <MonthlyBalanceChart months={months} />
        </Suspense>
      )}
      {open && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full border-collapse text-sm tabular-nums">
            <caption className="sr-only">
              Saldo bruto e rendimento por mês; abra um mês para ver cada dia
              útil
            </caption>
            <thead>
              <tr className="border-b border-border text-muted">
                <th scope="col" className="px-6 py-2 text-left font-medium">
                  Mês
                </th>
                <th scope="col" className={`${CELL} font-medium`}>
                  Rendimento
                </th>
                <th
                  scope="col"
                  className={`${CELL} hidden font-medium md:table-cell`}
                >
                  Rendimento acumulado
                </th>
                <th scope="col" className="px-6 py-2 text-right font-medium">
                  Saldo bruto
                </th>
              </tr>
            </thead>
            {months.map((month) => {
              const isExpanded = expanded.has(month.month);
              const daysId = `days-${month.month}`;
              return (
                <Fragment key={month.month}>
                  <tbody>
                    <tr className="border-b border-border">
                      <th
                        scope="row"
                        className="px-3 py-1 text-left font-normal"
                      >
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={daysId}
                          onClick={() => toggle(month.month)}
                          className="grid min-h-11 cursor-pointer grid-cols-[1rem_auto] items-center gap-x-2 rounded-control px-3 text-left hover:bg-accent-soft"
                        >
                          <span aria-hidden="true" className="text-muted">
                            {isExpanded ? '▾' : '▸'}
                          </span>
                          <span className="font-medium first-letter:uppercase">
                            {formatMonth(month.month)}
                          </span>
                          <span className="col-start-2 text-muted">
                            {month.businessDays}{' '}
                            {month.businessDays === 1
                              ? 'dia útil'
                              : 'dias úteis'}
                          </span>
                        </button>
                      </th>
                      <td className={CELL}>
                        {formatMoney(month.monthGrossEarnings)}
                      </td>
                      <td className={`${CELL} hidden md:table-cell`}>
                        {formatMoney(month.accumulatedGrossEarnings)}
                      </td>
                      <td className="px-6 py-2 text-right font-medium">
                        {formatMoney(month.closingGrossBalance)}
                      </td>
                    </tr>
                  </tbody>
                  <tbody id={daysId} hidden={!isExpanded} className="bg-bg">
                    {isExpanded &&
                      month.days.map((day) => (
                        <tr
                          key={day.date}
                          className="border-b border-border text-muted"
                        >
                          <th
                            scope="row"
                            className="py-1.5 pr-3 pl-14 text-left font-normal"
                          >
                            {formatIsoDate(day.date)}
                          </th>
                          <td className={CELL}>
                            {formatMoney(day.dailyGrossEarnings)}
                          </td>
                          <td className={`${CELL} hidden md:table-cell`}>
                            {formatMoney(day.accumulatedGrossEarnings)}
                          </td>
                          <td className="px-6 py-1.5 text-right">
                            {formatMoney(day.grossBalance)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </Fragment>
              );
            })}
          </table>
        </div>
      )}
    </details>
  );
}
