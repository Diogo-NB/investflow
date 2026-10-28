import { useState } from 'react';
import { formatIsoDate, formatMonth } from '../../dates/calendar-date';
import { shiftDecimal } from '../../decimals/decimal-string';
import { formatMoney, formatSharePercent } from '../../decimals/format-decimal';
import { TAG_BASE } from '../../simulations/ui/calculation-status-tag';
import { quietButton, surface } from '../../ui/styles';
import type {
  InvestmentPlanDetail,
  InvestmentPlanLiquidity,
  InvestmentPlanMaturityMonth,
  InvestmentPlanTotals,
} from '../models/investment-plan.types';

const SCHEDULE_PREVIEW_ROWS = 6;

const NEUTRAL_TAG = `${TAG_BASE} border-border bg-bg text-muted`;

function excludedNotice(count: number): string {
  return count === 1
    ? '1 simulação sem resultado fica fora dos totais.'
    : `${count} simulações sem resultado ficam fora dos totais.`;
}

function simulationCountLabel(count: number): string {
  return count === 1 ? '1 simulação' : `${count} simulações`;
}

// Null while none of the month's maturities has passed.
function maturedLabel({
  simulationCount,
  maturedSimulationCount,
}: InvestmentPlanMaturityMonth): string | null {
  if (maturedSimulationCount === 0) return null;
  return maturedSimulationCount === simulationCount
    ? 'Vencido'
    : `${maturedSimulationCount} de ${simulationCount} vencidas`;
}

function SummaryValues({ totals }: { readonly totals: InvestmentPlanTotals }) {
  const amounts: readonly [string, string][] = [
    ['Aplicado', totals.principal],
    ['IOF', totals.iof],
    ['IR', totals.incomeTax],
    ['Montante líquido', totals.netFinalBalance],
    ['Rendimento líquido', totals.netEarnings],
  ];
  return (
    <dl
      className={`${surface} m-0 grid grid-cols-2 gap-x-6 gap-y-4 p-4 sm:grid-cols-3 sm:p-6 lg:grid-cols-6`}
    >
      {amounts.map(([label, amount]) => (
        <div key={label} className="grid content-start gap-1">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="m-0 text-lg/tight font-semibold tabular-nums">
            {formatMoney(amount)}
          </dd>
        </div>
      ))}
      <div className="col-span-2 grid content-start gap-1 sm:col-span-1">
        <dt className="text-sm text-muted">Período</dt>
        <dd className="m-0 text-base/tight tabular-nums">
          {formatIsoDate(totals.period.start)} a{' '}
          {formatIsoDate(totals.period.end)}
        </dd>
      </div>
    </dl>
  );
}

function MaturitySchedule({
  months,
}: {
  readonly months: readonly InvestmentPlanMaturityMonth[];
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? months : months.slice(0, SCHEDULE_PREVIEW_ROWS);
  return (
    <section
      aria-labelledby="investment-plan-maturities-title"
      className={`${surface} grid content-start gap-2 p-4 sm:p-6 lg:col-span-2`}
    >
      <h3
        id="investment-plan-maturities-title"
        className="m-0 text-base font-semibold"
      >
        Vencimentos
      </h3>
      <table className="w-full border-collapse text-sm tabular-nums sm:text-base">
        <thead>
          <tr className="border-b border-border text-sm text-muted">
            <th scope="col" className="py-2 text-left font-medium">
              Mês
            </th>
            <th
              scope="col"
              className="hidden py-2 pl-4 text-right font-medium sm:table-cell"
            >
              Simulações
            </th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">
              Montante líquido
            </th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">
              Acumulado
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((month) => {
            const matured = maturedLabel(month);
            return (
              <tr key={month.month} className="border-b border-border">
                <th scope="row" className="py-2 text-left font-normal">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="whitespace-nowrap">
                      {formatMonth(month.month)}
                    </span>
                    {matured && (
                      <span className={`${NEUTRAL_TAG} whitespace-nowrap`}>
                        {matured}
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-muted sm:hidden">
                    {simulationCountLabel(month.simulationCount)}
                  </span>
                </th>
                <td className="hidden py-2 pl-4 text-right sm:table-cell">
                  {month.simulationCount}
                </td>
                <td className="py-2 pl-4 text-right">
                  {formatMoney(month.netFinalBalance)}
                </td>
                <td className="py-2 pl-4 text-right">
                  {formatMoney(month.accumulatedNetFinalBalance)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {months.length > SCHEDULE_PREVIEW_ROWS && (
        <button
          type="button"
          className={`${quietButton} justify-self-start`}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Mostrar menos' : `Mostrar todos (${months.length})`}
        </button>
      )}
    </section>
  );
}

function LiquiditySplit({
  liquidity,
}: {
  readonly liquidity: InvestmentPlanLiquidity;
}) {
  const parts: readonly [string, string, string, string][] = [
    ['Diária', liquidity.dailyPrincipal, liquidity.dailyShare, 'bg-accent'],
    [
      'No vencimento',
      liquidity.atMaturityPrincipal,
      liquidity.atMaturityShare,
      'bg-muted',
    ],
  ];
  return (
    <section
      aria-labelledby="investment-plan-liquidity-title"
      className={`${surface} grid content-start gap-4 p-4 sm:p-6`}
    >
      <h3
        id="investment-plan-liquidity-title"
        className="m-0 text-base font-semibold"
      >
        Liquidez
      </h3>
      {/* The amounts below carry the same split in text. */}
      <div aria-hidden className="flex h-3 overflow-hidden rounded-control">
        {parts.map(([label, , share, color]) => (
          <div
            key={label}
            className={color}
            style={{ width: `${shiftDecimal(share, 2)}%` }}
          />
        ))}
      </div>
      <dl className="m-0 grid gap-3">
        {parts.map(([label, amount, share, color]) => (
          <div
            key={label}
            className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1"
          >
            <span aria-hidden className={`size-3 rounded-control ${color}`} />
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="col-start-2 m-0 flex flex-wrap items-baseline gap-x-2 tabular-nums">
              <span className="text-lg/tight font-semibold">
                {formatMoney(amount)}
              </span>
              <span className="text-sm text-muted">
                {formatSharePercent(share)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Hidden for a plan without members, whose section already says so.
export function InvestmentPlanTotalsSection({
  plan,
}: {
  readonly plan: InvestmentPlanDetail;
}) {
  if (plan.simulationCount === 0) return null;
  const { totals } = plan;
  return (
    <section
      aria-labelledby="investment-plan-totals-title"
      className="grid gap-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2
          id="investment-plan-totals-title"
          className="m-0 text-lg font-semibold"
        >
          Resumo
        </h2>
        {totals?.isProvisional && (
          <span className={NEUTRAL_TAG}>Totais provisórios</span>
        )}
      </div>
      {totals === null ? (
        <p className="m-0 text-muted">Nenhuma simulação tem resultado ainda.</p>
      ) : (
        <>
          <p className="m-0 text-sm text-muted">
            Valores no vencimento de cada simulação, sem reinvestimento.
            {totals.excludedSimulationCount > 0 &&
              ` ${excludedNotice(totals.excludedSimulationCount)}`}
          </p>
          <SummaryValues totals={totals} />
          <div className="grid gap-4 lg:grid-cols-3">
            <MaturitySchedule months={totals.maturityMonths} />
            <LiquiditySplit liquidity={totals.liquidity} />
          </div>
        </>
      )}
    </section>
  );
}
