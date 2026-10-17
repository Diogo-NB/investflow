import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import { formatIsoDate } from '../../dates/calendar-date';
import { formatPercentOf } from '../../decimals/format-decimal';
import { InfoIcon } from '../../ui/icons';
import { quietButton, secondaryButton } from '../../ui/styles';
import type {
  SimulationResult,
  CalculationTaxes,
  IncomeTaxBracket,
  IofDailyRate,
  TaxRules,
} from '../models/simulation.types';
import { shiftDecimal } from '../../decimals/decimal-string';

const percent = (rate: string) => `${formatPercentOf(rate)}%`;

// The API decides the rates; these helpers only find them in the tables.

const sameRate = (left: string, right: string) =>
  shiftDecimal(left, 0) === shiftDecimal(right, 0);

function appliedIofRate(
  rules: TaxRules,
  taxes: CalculationTaxes,
): IofDailyRate | null {
  const { rate } = taxes.iof;
  if (rate === null) return null;
  return rules.iof.dailyRates.find((row) => sameRate(row.rate, rate)) ?? null;
}

function appliedIncomeTaxBracket(
  rules: TaxRules,
  taxes: CalculationTaxes,
): IncomeTaxBracket | undefined {
  const { rate } = taxes.incomeTax;
  if (rate === null) return undefined;
  return rules.incomeTax.brackets.find((bracket) =>
    sameRate(bracket.rate, rate),
  );
}

function bracketLabel(bracket: IncomeTaxBracket): string {
  if (bracket.upToCalendarDays === null) {
    return `A partir de ${bracket.fromCalendarDays} dias`;
  }
  return bracket.fromCalendarDays <= 1
    ? `Até ${bracket.upToCalendarDays} dias`
    : `De ${bracket.fromCalendarDays} a ${bracket.upToCalendarDays} dias`;
}

function Section({
  title,
  summary,
  formula,
  table,
}: {
  readonly title: string;
  readonly summary: string;
  readonly formula: ReactNode;
  readonly table?: ReactNode;
}) {
  return (
    <section className="grid gap-3 border-t border-border pt-5">
      <div>
        <h3 className="m-0 text-base font-semibold">{title}</h3>
        <p className="m-0 text-muted">{summary}</p>
      </div>
      <p className="m-0 rounded-control bg-bg px-4 py-3 font-medium tabular-nums">
        {formula}
      </p>
      {table}
    </section>
  );
}

const APPLIED_ROW = 'bg-accent-soft font-semibold';

function AppliedTag() {
  return (
    <span className="ml-2 rounded-control border border-accent px-1.5 text-sm font-medium text-accent">
      seu caso
    </span>
  );
}

function IofTable({
  rules,
  calculation,
}: {
  readonly rules: TaxRules;
  readonly calculation: SimulationResult;
}) {
  const applied = appliedIofRate(rules, calculation.taxes);
  const exempt = calculation.taxes.iof.rate === null;
  return (
    <details>
      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-accent">
        Tabela do IOF por dia corrido
      </summary>
      <ol className="m-0 grid list-none grid-cols-2 gap-1 p-0 text-sm tabular-nums sm:grid-cols-3">
        {rules.iof.dailyRates.map((row) => (
          <li
            key={row.calendarDay}
            className={`flex justify-between rounded-control px-2 py-1 ${row === applied ? APPLIED_ROW : ''}`}
          >
            <span>
              {row.calendarDay}º dia
              {row === applied && <span className="sr-only"> (seu caso)</span>}
            </span>
            <span>{percent(row.rate)}</span>
          </li>
        ))}
        <li
          className={`col-span-full flex justify-between rounded-control px-2 py-1 ${exempt ? APPLIED_ROW : ''}`}
        >
          <span>
            {rules.iof.exemptFromCalendarDays}º dia em diante
            {exempt && <AppliedTag />}
          </span>
          <span>isento</span>
        </li>
      </ol>
    </details>
  );
}

function IncomeTaxTable({
  rules,
  calculation,
}: {
  readonly rules: TaxRules;
  readonly calculation: SimulationResult;
}) {
  const applied = appliedIncomeTaxBracket(rules, calculation.taxes);
  return (
    <table className="w-full border-collapse text-sm tabular-nums">
      <caption className="sr-only">
        Alíquotas do imposto de renda por prazo
      </caption>
      <thead>
        <tr className="border-b border-border text-muted">
          <th scope="col" className="px-2 py-1 text-left font-medium">
            Prazo da aplicação
          </th>
          <th scope="col" className="px-2 py-1 text-right font-medium">
            Alíquota
          </th>
        </tr>
      </thead>
      <tbody>
        {rules.incomeTax.brackets.map((bracket) => (
          <tr
            key={bracket.fromCalendarDays}
            className={bracket === applied ? APPLIED_ROW : ''}
          >
            <th scope="row" className="px-2 py-1 text-left font-normal">
              {bracketLabel(bracket)}
              {bracket === applied && <AppliedTag />}
            </th>
            <td className="px-2 py-1 text-right">{percent(bracket.rate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TaxExplanationDialog({
  calculation,
  rules,
}: {
  readonly calculation: SimulationResult;
  readonly rules: TaxRules;
}) {
  const { taxes } = calculation;
  const days = calculation.term.calendarDays;
  const exemptFrom = rules.iof.exemptFromCalendarDays;
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={`${quietButton} gap-2 justify-self-start px-0`}
      >
        <InfoIcon />
        Como os tributos foram calculados
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-fg opacity-30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 grid max-h-[calc(100dvh-2rem)] w-xl max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 content-start gap-5 overflow-y-auto rounded-surface border border-border bg-surface p-6 text-fg outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="m-0 text-lg font-semibold">
              Tributos
            </Dialog.Title>
            <Dialog.Close className={secondaryButton}>Fechar</Dialog.Close>
          </div>
          <Dialog.Description className="m-0">
            Incidem sobre o rendimento e dependem do prazo:{' '}
            <strong className="font-semibold">{days} dias corridos</strong> (
            {formatIsoDate(calculation.term.investmentDate)} a{' '}
            {formatIsoDate(calculation.term.maturityDate)}).
          </Dialog.Description>

          <Section
            title="IOF"
            summary={`Cobrado só em resgates com menos de ${exemptFrom} dias; a alíquota cai a cada dia.`}
            formula={taxes.iof.formula}
            table={<IofTable rules={rules} calculation={calculation} />}
          />

          {taxes.incomeTax.rate === null ? (
            <Section
              title="Imposto de renda"
              summary="LCI e LCA não pagam imposto de renda quando o investidor é pessoa física."
              formula={taxes.incomeTax.formula}
            />
          ) : (
            <Section
              title="Imposto de renda"
              summary="Calculado sobre o rendimento menos o IOF; a alíquota cai quanto maior o prazo."
              formula={taxes.incomeTax.formula}
              table={<IncomeTaxTable rules={rules} calculation={calculation} />}
            />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
