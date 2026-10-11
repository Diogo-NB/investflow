import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { formatMonth, formatShortMonth } from '../../dates/calendar-date';
import { formatMoney } from '../../decimals/format-decimal';
import type { MonthlyBalance } from '../models/simulation.types';

interface Point {
  readonly month: string;
  // Plotting only; the tooltip shows the exact decimal strings.
  readonly balance: number;
  readonly source: MonthlyBalance;
}

const compactMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const TICK = { fill: 'var(--color-muted)', fontSize: 12 };

function BalanceTooltip({ active, payload }: TooltipContentProps) {
  const point = payload[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="grid gap-0.5 rounded-control border border-border bg-surface px-3 py-2 text-sm tabular-nums">
      <p className="m-0 font-medium first-letter:uppercase">
        {formatMonth(point.month)}
      </p>
      <p className="m-0">
        Saldo bruto {formatMoney(point.source.closingGrossBalance)}
      </p>
      <p className="m-0 text-muted">
        Rendimento acumulado{' '}
        {formatMoney(point.source.accumulatedGrossEarnings)}
      </p>
    </div>
  );
}

export function MonthlyBalanceChart({
  months,
}: {
  readonly months: readonly MonthlyBalance[];
}) {
  const points: Point[] = months.map((month) => ({
    month: month.month,
    balance: Number(month.closingGrossBalance),
    source: month,
  }));
  return (
    <figure className="m-0 border-t border-border px-3 pt-4 pb-2 sm:px-6">
      <figcaption className="sr-only">
        Gráfico do saldo bruto no fim de cada mês; os valores exatos estão na
        tabela a seguir
      </figcaption>
      <AreaChart
        responsive
        data={points}
        className="h-64 w-full"
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="month"
          tickFormatter={formatShortMonth}
          tick={TICK}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-border)' }}
          minTickGap={16}
        />
        {/* A zero baseline would flatten the slow growth of the balance. */}
        <YAxis
          domain={['auto', 'auto']}
          tickFormatter={(value: number) => compactMoney.format(value)}
          tick={TICK}
          tickLine={false}
          axisLine={false}
          width="auto"
        />
        <Tooltip
          content={BalanceTooltip}
          cursor={{ stroke: 'var(--color-muted)' }}
        />
        {/* Recharts animates in JS, outside the reduced-motion CSS rule. */}
        <Area
          dataKey="balance"
          type="monotone"
          stroke="var(--color-accent)"
          strokeWidth={2}
          fill="var(--color-accent-soft)"
          fillOpacity={1}
          activeDot={{ r: 4, fill: 'var(--color-accent)' }}
          isAnimationActive={false}
        />
      </AreaChart>
    </figure>
  );
}
