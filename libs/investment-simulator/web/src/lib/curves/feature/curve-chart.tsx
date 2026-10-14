import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  usePlotArea,
  useActiveTooltipDataPoints,
  XAxis,
  YAxis,
} from 'recharts';
import { formatIsoDate } from '../../dates/calendar-date';
import type { EconomicIndex } from '../../offers/models/offer-terms';
import { formatCurveValue, isMonthly } from '../models/curve-terms';
import type { CurveInterval } from '../models/curve.types';
import {
  curveChartData,
  type CurveChartPoint,
} from '../utils/curve-chart-data';

const TICK = { fill: 'var(--color-muted)', fontSize: 12 };

const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

// The hovered interval, drawn in the strip reserved above the plot: a
// floating tooltip near the axis would cover its labels.
function ActiveIntervalReadout({ index }: { readonly index: EconomicIndex }) {
  const point = useActiveTooltipDataPoints<CurveChartPoint>()?.[0];
  const plot = usePlotArea();
  if (!point || !plot) return null;
  const { startDate, endDate, value } = point.interval;
  const period =
    startDate === endDate
      ? formatIsoDate(startDate)
      : `${formatIsoDate(startDate)} a ${formatIsoDate(endDate)}`;
  return (
    <text
      x={plot.x + plot.width}
      y={plot.y - 12}
      textAnchor="end"
      fontSize={13}
      fill="var(--color-fg)"
      className="tabular-nums"
    >
      <tspan fontWeight={600}>{formatCurveValue(index, value)}</tspan>
      <tspan fill="var(--color-muted)"> · {period}</tspan>
    </text>
  );
}

export function CurveChart({
  index,
  intervals,
}: {
  readonly index: EconomicIndex;
  readonly intervals: readonly CurveInterval[];
}) {
  const data = curveChartData(intervals);
  if (!data) return null;
  const labels = new Map(data.ticks.map((tick) => [tick.day, tick.label]));
  return (
    <figure className="m-0 px-3 pt-4 pb-2 sm:px-6">
      <figcaption className="sr-only">
        Gráfico {isMonthly(index) ? 'da variação mensal' : 'da taxa anual'} em
        cada intervalo da curva; os valores exatos estão na tabela a seguir
      </figcaption>
      <LineChart
        responsive
        data={data.points as CurveChartPoint[]}
        className="h-72 w-full"
        // The top strip holds the hovered interval's readout.
        margin={{ top: 32, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="day"
          type="number"
          scale="linear"
          domain={data.domain as [number, number]}
          ticks={data.ticks.map((tick) => tick.day)}
          tickFormatter={(day: number) => labels.get(day) ?? ''}
          tick={TICK}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-border)' }}
        />
        {/* A zero baseline would flatten the differences between rates. */}
        <YAxis
          domain={['auto', 'auto']}
          tickFormatter={(value: number) => `${percent.format(value)}%`}
          tick={TICK}
          tickLine={false}
          axisLine={false}
          width="auto"
        />
        {data.crossesZero && (
          <ReferenceLine y={0} stroke="var(--color-muted)" />
        )}
        <Tooltip
          content={() => null}
          cursor={{ stroke: 'var(--color-muted)' }}
        />
        <ActiveIntervalReadout index={index} />
        {/* Points come in steps, so straight segments draw each interval
            flat. Recharts animates in JS, outside the reduced-motion CSS
            rule. */}
        <Line
          dataKey="value"
          type="linear"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: 'var(--color-accent)' }}
          isAnimationActive={false}
        />
      </LineChart>
    </figure>
  );
}
